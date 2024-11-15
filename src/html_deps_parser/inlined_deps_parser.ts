/** this module provides the {@link parseHtmlInlinedDeps} function that can extract the direct inlined dependencies of an html file, and replace the dependency
 * html-elements with a placeholder elements, so that they can be easily rediscovered when the contents of the transpiled/bundled resources need to be injected back.
 * 
 * @module
*/

import { DOMParser, object_entries } from "../deps.ts"
import { getDirUrlFromFile } from "../funcdefs.ts"
import type { AbsolutePath } from "../typedefs.ts"
import { stringifyHtmlDocument } from "./funcdefs.ts"
import type { HtmlDependency } from "./typedefs.ts"


export const
	// the name of the attribute that will carry the information about the resource's unique id
	resource_element_src_attr = "res-src-inline" as const,
	// this is the uri scheme that we will use for inlined resources' id
	resource_element_src_uri_scheme = "inline://" as const

export interface HtmlDependencyInlined extends HtmlDependency {
	/** the content block of the resource, extracted through `element.innerHTML` of the original inline resource element. */
	content: Uint8Array
	/** the path to the diectory in which the inline resource's html file exists.
	 * this is information is necessary when the inline resource makes a relative reference in an import statement.
	 * this value is derived from the {@link parseHtmlInlinedDepsConfig.path} option passed to the {@link parseHtmlInlinedDeps} parsing function.
	*/
	path: URL
	id: `${typeof resource_element_src_uri_scheme}${number}`
}

/** this interface defines the inlined dependencies of an html file.
 * each dependency is identified via a query selector specified in {@link htmlInlinedDependencySelectors}.
 * here is a table summary of what gets picked:
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

const
	text_encoder = new TextEncoder(),
	text_decoder = new TextDecoder()
let inlined_resource_id_counter = 0

/** returns the inlined dependencies of an html file. */
export const parseHtmlInlinedDeps = (html_content: string, config: parseHtmlInlinedDepsConfig = {}): ParsedHtmlInlinedDependencies => {
	const
		{ path: html_path = "./index.html" } = config,
		dir_url = getDirUrlFromFile(html_path),
		doc = new DOMParser().parseFromString(html_content, "text/html"),
		depsInlined: HtmlInlinedDependencies = {} as any

	for (const [dep_type_key, { selector }] of object_entries(htmlInlinedDependencySelectors) as Array<[keyof HtmlInlinedDependencies, InlinedDependencySelector]>) {
		const all_deps_of_a_certain_type: Array<HtmlDependencyInlined> = []
		depsInlined[dep_type_key] = all_deps_of_a_certain_type
		for (const elem of doc.querySelectorAll(selector)) {
			// first we ensure that `elem` has not already been marked as an inline dependency, because if it has been, then we'll have to skip it
			if (elem.hasAttribute(resource_element_src_attr)) { continue }
			const
				// the reason why we use `elem.innerHTML` instead of `elem.textContent` is because the xml-blocks inside of an svg block will not get parsed by the latter method.
				resource_content: Uint8Array = text_encoder.encode(elem.innerHTML),
				id: HtmlDependencyInlined["id"] = `${resource_element_src_uri_scheme}${inlined_resource_id_counter++}`
			elem.innerHTML = ""
			elem.setAttribute(resource_element_src_attr, id)
			all_deps_of_a_certain_type.push({ id, path: dir_url, content: resource_content })
		}
	}

	return {
		html: stringifyHtmlDocument(doc as any),
		depsInlined,
	}
}

// DONE: implement `unparseHtmlInlinedDeps`, which should place back the dependencies specified in a `ParsedHtmlInlinedDependencies` to the contents of an html file
/** merges inline dependency resources back into an html file's contents, and returns it back. */
export const unparseHtmlInlinedDeps = (html_content: ParsedHtmlInlinedDependencies["html"], inlined_deps: ParsedHtmlInlinedDependencies["depsInlined"]): string => {
	const doc = new DOMParser().parseFromString(html_content, "text/html")

	for (const [dep_type_key, all_deps_of_a_certain_type] of object_entries(inlined_deps) as Array<[keyof typeof inlined_deps, Array<HtmlDependencyInlined>]>) {
		for (const inlined_dep of all_deps_of_a_certain_type) {
			const
				{ content, id } = inlined_dep,
				resource_content = typeof content === "string" ? content : text_decoder.decode(content),
				selector = `*\[${resource_element_src_attr}=\"${id}\"\]`,
				elem = doc.querySelector(selector)
			if (!elem) { throw new Error(`did not find inlined resource id: "${id}" in the provided html content`) }
			elem.removeAttribute(resource_element_src_attr)
			elem.innerHTML = resource_content
		}
	}

	return stringifyHtmlDocument(doc as any)
}
