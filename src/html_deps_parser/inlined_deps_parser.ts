/** this module provides the {@link parseHtmlInlinedDeps} function that can extract the direct inlined dependencies of an html file, and replace the dependency
 * html-elements with a placeholder elements, so that they can be easily rediscovered when the contents of the transpiled/bundled resources need to be injected back.
 * 
 * @module
*/

import { DOMParser } from "../deps.ts"
import { getDirUrlFromFile } from "../funcdefs.ts"
import type { AbsolutePath } from "../typedefs.ts"
import { copyElementAttributes, stringifyHtmlDocument } from "./funcdefs.ts"
import type { HtmlDependency } from "./typedefs.ts"


export const
	// the html element tag name of what we swap our resource elements with
	resource_element_html_tag = "res-inline" as const,
	// the name of the attribute that will carry the information about the resource's unique id
	resource_element_id_attr = "rid" as const,
	// this is the uri scheme that we will use for inlined resources' id
	resource_element_id_uri_scheme = "inline://" as const

export interface HtmlDependencyInlined extends HtmlDependency {
	/** the content block of the resource, extracted through `element.innerHTML` of the original inline resource element. */
	content: Uint8Array
	/** the path to the diectory in which the inline resource's html file exists.
	 * this is information is necessary when the inline resource makes a relative reference in an import statement.
	 * this value is derived from the {@link parseHtmlInlinedDepsConfig.path} option passed to the {@link parseHtmlInlinedDeps} parsing function.
	*/
	path: URL
	id: `${typeof resource_element_id_uri_scheme}${number}`
}

/** this interface defines the inlined dependencies of an html file.
 * each dependency is identified via a query selector specified in {@link htmlInlinedDependencySelectors}.
 * here is a table summary of what gets picked:
 *
 * ## Table of Direct HTML Inlined Dependencies
 * ### Supported dependencies
 * 
 * | key   | description            | query selector                 | example of selectable element                       |
 * |-------|------------------------|--------------------------------|-----------------------------------------------------|
 * | `js`  | Inline JavaScript      | `script:not([src])`            | `<script>console.log("Hello World")</script>`       |
 * | `css` | Inline CSS             | `style`                        | `<style>body { ... }</style>`                       |
 * | `svg` | Embedded SVG Elements  | `svg`                          | `<svg xmlns="http://www.w3.org/2000/svg">...</svg>` |
 * 
*/
export interface HtmlInlinedDependencies {
	js: Array<HtmlDependencyInlined>
	css: Array<HtmlDependencyInlined>
	svg: Array<HtmlDependencyInlined>
}

/** a descriptor of which html elements to select and extract their inlined content (`element.innerHTML`). */
interface InlinedDependencySelector {
	/** the css-query selector to pick out the inlined dependency element.
	 * examples: `"script:not([src])"`, or `"style"`
	*/
	selector: string
}

const htmlInlinedDependencySelectors: Record<keyof HtmlInlinedDependencies, InlinedDependencySelector> = {
	js: { selector: "script:not([src])" },
	css: { selector: "style" },
	svg: { selector: "svg" },
}


interface parseHtmlInlinedDepsConfig {
	/** the absolute path of the html file that you are providing the contents of. <br>
	 * this value is used for deducing the directory in which the html exists, so that any relative references made inside any inlined dependency's content will be discoverable. <br>
	 * if no path is provided, then it will be assumed that the html file exists in the current working directory (i.e. something like `"./index.html"`). <br>
	 * the absolute path can also use a uri scheme like `"http://"` or `"jsr:"` or `"file://"`, but if a relative path was provided,
	 * we would again assume that it is relative to the current working directory.
	 * 
	 * an example of a scenario where this path is absolutely crucial:
	 * ```html
	 * <!DOCTYPE hml>
	 * <html>
	 * 	<head>
	 * 		<script type="module">
	 * 			import { someFunction } from "../lib/my_library.ts" // this relative path cannot be resolved without the `path` of the html file.
	 * 			import { React } from "https://cdn.example.com/react.js" // this absolute url does not require the `path` of the html file.
	 * 			// do stuff
	 * 		</script>
	 * 		<!-- the style imports below also use a relative path, which will require the `path` of this html file to be resolved. -->
	 * 		<style>
	 * 			\@import url("../css/style1.css");
	 * 			\@import "./style2.css";
	 * 		</script>
	 * 		<!-- the style imports below have an absolute path, hence they will not utilize the `path` of this html file. -->
	 * 		<style>
	 * 			\@import url("file://my/projects/abcd/css/style1.css");
	 * 			\@import "npm:normalize-css/style.css";
	 * 		</script>
	 * 	</head>
	 * </html>
	 * ```
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

export interface ParsedHtmlInlinedDependencies {
	html: string
	depsInlined: HtmlInlinedDependencies
}

const text_encoder = new TextEncoder()
let inlined_resource_id_counter = 0

/** returns the inlined dependencies of an html file. */
export const parseHtmlInlinedDeps = (html_content: string, config: parseHtmlInlinedDepsConfig = {}): ParsedHtmlInlinedDependencies => {
	const
		{ path: html_path = "./index.html" } = config,
		dir_url = getDirUrlFromFile(html_path),
		doc = new DOMParser().parseFromString(html_content, "text/html")

	const html_inlined_deps = Object.fromEntries((Object
		.entries(htmlInlinedDependencySelectors) as Array<[keyof HtmlInlinedDependencies, InlinedDependencySelector]>)
		.map(([dep_type_key, { selector }]) => {
			const all_deps_of_a_certain_type: HtmlDependencyInlined[] = [...doc.querySelectorAll(selector)].map((elem) => {
				const
					// the reason why we use `elem.innerHTML` instead of `elem.textContent` is because the xml-blocks inside of an svg block will not get parsed by the latter method.
					resource_content: Uint8Array = text_encoder.encode(elem.innerHTML),
					id: HtmlDependencyInlined["id"] = `${resource_element_id_uri_scheme}${inlined_resource_id_counter++}`,
					resource_elem = doc.createElement(resource_element_html_tag)
				// we also replace the original reference element with a `<res-inline hash="inline://${unique_integer}"></res-inline>` element, so that later on,
				// we could come back after the transpilation/bundling process and insert back the original element.
				copyElementAttributes(elem as any, resource_elem as any)
				resource_elem.setAttribute(resource_element_id_attr, id)
				elem.replaceWith(resource_elem)
				return { id, content: resource_content, path: dir_url }
			})
			return [dep_type_key, all_deps_of_a_certain_type] satisfies [keyof HtmlInlinedDependencies, Array<HtmlDependencyInlined>]
		})) as unknown as HtmlInlinedDependencies

	return {
		html: stringifyHtmlDocument(doc as any),
		depsInlined: html_inlined_deps,
	}
}

// TODO: implement `unparseHtmlInlinedDeps`, which should place back the dependencies specified in a `ParsedHtmlInlinedDependencies` to the contents of an html file

