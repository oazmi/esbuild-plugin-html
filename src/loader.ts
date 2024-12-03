import { DEBUG, DOMParser, GenericLoader, object_entries, textEncoder, zipArrays, type ContentDependencies, type GenericLoaderConfig } from "./deps.ts"
import { stringifyHtmlDocument } from "./html_deps_parser/funcdefs.ts"


/** a descriptor of which html elements to select and extract their linked resource's url or pathname. */
export interface LinkResourceSelector {
	/** the css-query selector to pick out the linked dependency element.
	 * examples: `"script[src]"`, or `"link[rel=\"stylesheet\"][href]"`
	*/
	selector: string

	/** the name of the element attribute containing the url or path link to the linked resource.
	 * examples: `"src"`, or `"href"`
	*/
	attribute: string
}

/** a descriptor of which html elements to select and extract their inlined content (`element.innerHTML`). */
export interface InlineResourceSelector {
	/** the css-query selector to pick out the inlined dependency element.
	 * examples: `"script:not([src])"`, or `"style"`
	*/
	selector: string
}

/** configuration for linked (referenced) dependencies of an html file.
 * 
 * each dependency is identified via a query selector specified in {@link resourceSelectors}.
 * here is a table summary of what gets picked:
 *
 * ## Table of Direct HTML Dependencies
 * ### Supported dependencies
 * 
 * | key   | description            | query selector                 | example of selectable element               |
 * |-------|------------------------|--------------------------------|---------------------------------------------|
 * | `js`  | Referenced JavaScript  | `script[src]`                  | `<script src="./script.js"></script>`       |
 * | `css` | Referenced CSS         | `link[rel="stylesheet"][href]` | `<link rel="stylesheet" href="styles.css">` |
 * | `img` | Referenced Image       | `img[src]`                     | `<img src="http://example.com/img.png">`    |
 * | `img` | Embedded Base64 Images | `img[src^="data:"]`            | `<img src="data:image/png;base64,...">`     |
 * | `ico` | Referenced Icon        | `link[rel~="icon"][href]`      | `<link rel="icon" href="../favicon.ico">`   |
 * 
*/
export interface LinkDepsConfig {
	/** the name of the attribute that will carry the information about the resource's unique id. it must be unique.
	 * 
	 * @ defaultValue `"res-id-link"`
	*/
	resourceAttr: string

	/** a list of selectors for various linkable object types.
	 * 
	 * ~their names should correspond to the esbuild loader (`esbuild.Loader`) they will be utilizing.~ <br>
	 * their names should correspond to the file extension of the object they link to.
	*/
	resourceSelectors: {
		js: LinkResourceSelector
		css: LinkResourceSelector
		img: LinkResourceSelector
		ico: LinkResourceSelector
	}
}

/** configuration for inlined dependencies of an html file.
 * 
 * each dependency is identified via a query selector specified in {@link resourceSelectors}.
 * below is a table summary of what gets picked:
 * 
 * ## Table of Direct HTML Inlined Dependencies
 * ### Supported dependencies
 * 
 * | key   | description            | query selector      | example of selectable element                       |
 * |-------|------------------------|---------------------|-----------------------------------------------------|
 * | `js`  | Inline JavaScript      | `script:not([src])` | `<script>console.log("Hello World")</script>`       |
 * | `css` | Inline CSS             | `style`             | `<style>body { ... }</style>`                       |
 * | `svg` | Embedded SVG Elements  | `svg`               | `<svg xmlns="http://www.w3.org/2000/svg">...</svg>` |
 * 
*/
export interface InlineDepsConfig {
	/** the name of the attribute that will carry the information about the resource's unique id. it must be unique.
	 * 
	 * @ defaultValue `"res-id-inline"`
	*/
	resourceAttr: string

	/** a list of selectors for various linkable object types.
	 * 
	 * ~their names should correspond to the esbuild loader (`esbuild.Loader`) they will be utilizing.~ <br>
	 * their names should correspond to the file extension of the object they link to.
	*/
	resourceSelectors: {
		js: InlineResourceSelector
		css: InlineResourceSelector
		svg: InlineResourceSelector
	}
}

export interface HtmlLoaderConfig extends GenericLoaderConfig {
	linkDepsConfig: LinkDepsConfig
	inlineDepsConfig: InlineDepsConfig
}

const defaultLinkDepsConfig: LinkDepsConfig = {
	resourceAttr: "res-id-link",
	resourceSelectors: {
		js: {
			selector: "script[src]",
			attribute: "src",
		},
		css: {
			selector: "link[rel=\"stylesheet\"][href]",
			attribute: "href",
		},
		img: {
			selector: "img[src]",
			attribute: "src",
		},
		ico: {
			selector: "link[rel~=\"icon\"][href]",
			attribute: "href",
		},
	}
}

const defaultInlineDepsConfig: InlineDepsConfig = {
	resourceAttr: "res-id-inline",
	resourceSelectors: {
		js: { selector: "script:not([src])" },
		css: { selector: "style" },
		svg: { selector: "svg" },
	}
}

interface HtmlBaseDepKey {
	id: number
	kind: string
	selector: string
	loader: string
}

interface HtmlLinkDepKey extends HtmlBaseDepKey {
	kind: "link"
	attribute: string
	loader: keyof LinkDepsConfig["resourceSelectors"]
}

interface HtmlInlineDepKey extends HtmlBaseDepKey {
	kind: "inline"
	loader: keyof InlineDepsConfig["resourceSelectors"]
}

export type HtmlAnyDepKey = HtmlInlineDepKey | HtmlLinkDepKey

export class HtmlLoader extends GenericLoader<HtmlAnyDepKey> {
	readonly linkDepsConfig: LinkDepsConfig
	readonly inlineDepsConfig: InlineDepsConfig

	constructor(config: Partial<HtmlLoaderConfig> = {}) {
		super(config)
		this.linkDepsConfig = { ...defaultLinkDepsConfig, ...config.linkDepsConfig }
		this.inlineDepsConfig = { ...defaultInlineDepsConfig, ...config.inlineDepsConfig }
	}

	override async extractDeps(content: string): Promise<ContentDependencies<HtmlAnyDepKey>> {
		const
			{ linkDepsConfig, inlineDepsConfig } = this,
			importKeys: HtmlAnyDepKey[] = [],
			importPaths: string[] = [],
			doc = new DOMParser().parseFromString(content, "text/html")

		let resource_id = 0

		const link_resource_id_attr = linkDepsConfig.resourceAttr
		for (const [dep_extension, { selector, attribute }] of object_entries(linkDepsConfig.resourceSelectors) as Array<[keyof LinkDepsConfig["resourceSelectors"], LinkResourceSelector]>) {
			for (const elem of doc.querySelectorAll(selector)) {
				// first we ensure that `elem` has not already been marked as a linked dependency, because if it has been, then we'll have to skip it
				if (elem.hasAttribute(link_resource_id_attr)) { continue }
				const
					path = elem.getAttribute(attribute)!,
					id = resource_id++,
					element_selector = `${selector}\[${link_resource_id_attr}="${id}"\]`,
					dep_key: HtmlLinkDepKey = {
						id,
						kind: "link",
						selector: element_selector,
						attribute: attribute,
						loader: dep_extension,
					}
				// we remove the original source link `attribute`, and replace it with our custom `"res-id-link"` attribute.
				// during the unparsing stage, we will have to do the reverse and set the original `attribute` to the resolved path/url of this dependency.
				// elem.removeAttribute(attribute)
				elem.setAttribute(link_resource_id_attr, id)
				importKeys.push(dep_key)
				importPaths.push(path)
			}
		}

		// TODO: the block below needs some kind of virtual file dependency management system (possibly an esbuild plugin).
		//       so for now, we don't bundle inline dependencies.
		const inline_resource_id_attr = inlineDepsConfig.resourceAttr
		for (const [dep_extension, { selector }] of object_entries(inlineDepsConfig.resourceSelectors) as Array<[keyof InlineDepsConfig["resourceSelectors"], InlineResourceSelector]>) {
			for (const elem of doc.querySelectorAll(selector)) {
				// first we ensure that `elem` has not already been marked as an inline dependency, because if it has been, then we'll have to skip it
				if (elem.hasAttribute(inline_resource_id_attr)) { continue }
				const
					// the reason why we use `elem.innerHTML` instead of `elem.textContent` is because the xml-blocks inside of an svg block will not get parsed by the latter method.
					resource_content: Uint8Array = textEncoder.encode(elem.innerHTML),
					// TODO: create a virtual path and a virtual file associated to that path
					path = "", //elem.getAttribute(attribute)!,
					id = resource_id++,
					element_selector = `${selector}\[${inline_resource_id_attr}="${id}"\]`,
					dep_key: HtmlInlineDepKey = {
						id,
						kind: "inline",
						selector: element_selector,
						loader: dep_extension,
					}
				elem.setAttribute(inline_resource_id_attr, id)
				// TODO: once the virtual path and files have been implemented, you can uncomment the lines below to mark your dependency
				// elem.innerHTML = ""
				// importKeys.push(dep_key)
				// importPaths.push(path)
			}
		}

		const html_content = stringifyHtmlDocument(doc as any)
		return {
			content: html_content,
			importKeys,
			importPaths,
		}
	}

	override async insertDeps(dependencies: ContentDependencies<HtmlAnyDepKey>): Promise<string> {
		const
			{ linkDepsConfig, inlineDepsConfig } = this,
			link_resource_id_attr = linkDepsConfig.resourceAttr,
			inline_resource_id_attr = inlineDepsConfig.resourceAttr,
			{ content: html_content, importKeys, importPaths } = dependencies,
			doc = new DOMParser().parseFromString(html_content, "text/html")

		zipArrays<[HtmlAnyDepKey, string]>(importKeys, importPaths).forEach(([dep_key, bundled_path]) => {
			const { id, kind, loader, selector } = dep_key
			if (kind === "link") {
				const
					{ attribute } = dep_key,
					elem = doc.querySelector(selector)
				if (DEBUG.ASSERT && !elem) { throw new Error(`failed to find resource "${id}" element with the following selector: "${selector}"`) }
				elem?.setAttribute(attribute, bundled_path)
				elem?.removeAttribute(link_resource_id_attr)
			} else if (kind === "inline") {
				// TODO: implement once virtual paths and virtual files have been implemented
				// elem?.innerHTML = decodeText(resource_content)
				// elem?.removeAttribute(inline_resource_id_attr)
			}
		})

		return stringifyHtmlDocument(doc as any)
	}
}
