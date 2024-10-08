/** this module provides the {@link parseHtmlLinkedDeps} function that can extract the direct dependencies of an html file, and replace the dependency
 * html-elements with a placeholder elements, so that they can be easily rediscovered when the links/contents to transpiled/bundled resources need to be injected back.
 * 
 * @module
*/

import { DOMParser, resolveAsUrl } from "../deps.ts"
import { getDirUrlFromFile } from "../funcdefs.ts"
import type { AbsolutePath } from "../typedefs.ts"
import { copyElementAttributes, stringifyHtmlDocument } from "./funcdefs.ts"
import type { HtmlDependency } from "./typedefs.ts"


export const
	// the html element tag name of what we swap our resource elements with
	resource_element_html_tag = "res-link" as const,
	// the name of the attribute that will carry the information about the resource's unique id
	resource_element_id_attr = "rid" as const

export interface HtmlDependencyLinked extends HtmlDependency {
	/** the url of the resource. */
	url: URL
	id: this["url"]["href"]
}

/** this interface defines the linked (referenced) dependencies of an html file.
 * each dependency is identified via a query selector specified in {@link htmlLinkedDependencySelectors}.
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
export interface HtmlLinkedDependencies {
	js: Array<HtmlDependencyLinked>
	css: Array<HtmlDependencyLinked>
	img: Array<HtmlDependencyLinked>
	ico: Array<HtmlDependencyLinked>
}

/** a descriptor of which html elements to select and extract their linked resource's url or pathname. */
interface LinkedDependencySelector {
	/** the css-query selector to pick out the linked dependency element.
	 * examples: `"script[src]"`, or `"link[rel=\"stylesheet\"][href]"`
	*/
	selector: string

	/** the name of the element attribute containing the url or path link to the linked resource.
	 * examples: `"src"`, or `"href"`
	*/
	attribute: string
}

const htmlLinkedDependencySelectors: Record<keyof HtmlLinkedDependencies, LinkedDependencySelector> = {
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


interface parseHtmlLinkedDepsConfig {
	/** the absolute path of the html file that you are providing the contents of. <br>
	 * this value is used for deducing the directory in which the html exists, so that any relative references made in the html file will be discoverable. <br>
	 * if no path is provided, then it will be assumed that the html file exists in the current working directory (i.e. something like `"./index.html"`). <br>
	 * the absolute path can also use a uri scheme like `"http://"` or `"jsr:"` or `"file://"`, but if a relative path was provided,
	 * we would again assume that it is relative to the current working directory.
	*/
	path?: AbsolutePath

	/** TODO: define how should the html should bundle its dependencies:
	 * - `"bundle"` | `undefined`: html file will reference its entry points will be bundled as separate files, inheriting the basename of the importer javascript.
	 * - `"inject"`: any referenced files via `<script src="./file.js">` or `<link rel="stylesheet" href="./file.css">` will get injected be bundled into a string literal, which will then get injected into your html `document`'s head as a `<style>` element.
	 * - `"inject-link"`: similar to `"bundle"`, but will also inject a `<link>` element into your `document`'s head that link's to the output bundled css file.
	 * 
	 * TODO: implement `"inject-link"`
	*/
	mode?: "bundle" | "inject"
}

export interface ParsedHtmlLinkedDependencies {
	html: string
	depsLinked: HtmlLinkedDependencies
}

/** returns the linked dependencies of an html file. */
export const parseHtmlLinkedDeps = (html_content: string, config: parseHtmlLinkedDepsConfig = {}): ParsedHtmlLinkedDependencies => {
	const
		{ path: html_path = "./index.html" } = config,
		dir_url = getDirUrlFromFile(html_path),
		doc = new DOMParser().parseFromString(html_content, "text/html")

	const html_linked_deps = Object.fromEntries((Object
		.entries(htmlLinkedDependencySelectors) as Array<[keyof HtmlLinkedDependencies, LinkedDependencySelector]>)
		.map(([dep_type_key, { selector, attribute }]) => {
			const all_deps_of_a_certain_type: HtmlDependencyLinked[] = [...doc.querySelectorAll(selector)].map((elem) => {
				const
					// below, `dir_url` is used as the base path if `elem.getAttribute(attribute)` is a relative link. but if it is absolute, then `html_dir_url` will not be part of the base path.
					resource_url: URL = resolveAsUrl(elem.getAttribute(attribute)!, dir_url),
					id = resource_url.href,
					resource_elem = doc.createElement(resource_element_html_tag)
				// we also replace the original reference element with a `<res-link rid="${resource_url.href}"></res-link>` element, so that later on,
				// we could come back after the transpilation/bundling process and insert back the original element, with the exception of having
				// its reference `attribute` replaced with the path of the transpiled/bundled resource.
				copyElementAttributes(elem as any, resource_elem as any)
				resource_elem.removeAttribute(attribute)
				resource_elem.setAttribute(resource_element_id_attr, id)
				elem.replaceWith(resource_elem)
				return { id, url: resource_url }
			})
			return [dep_type_key, all_deps_of_a_certain_type] satisfies [keyof HtmlLinkedDependencies, Array<HtmlDependencyLinked>]
		})) as unknown as HtmlLinkedDependencies

	return {
		html: stringifyHtmlDocument(doc as any),
		depsLinked: html_linked_deps,
	}
}

// TODO: implement `unparseHtmlLinkedDeps`, which should place back the dependencies specified in a `ParsedHtmlLinkedDependencies` to the contents of an html file

