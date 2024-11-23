import { DOMParser, resolveAsUrl } from "../deps.ts"
import { escapeString, escapeStringForRegex, getDirUrlFromFile, stringToJsEvalString } from "../funcdefs.ts"
import { stringifyHtmlDocument } from "../html_deps_parser/funcdefs.ts"
import type { AbsolutePath } from "../typedefs.ts"
import { TemplateKvStorage } from "./template_kv_storage.ts"

interface GenericLoaderConfig {
	/** the absolute path of the file that you are providing the contents of to {@link GenericLoader}.
	 * 
	 * this value is used for deducing the directory in which the html exists, so that any relative references made in the html file will be discoverable. <br>
	 * if no path is provided, then it will be assumed that the html file exists in the current working directory (i.e. something like `"./index.html"`). <br>
	 * the absolute path can also use a uri scheme like `"http://"` or `"jsr:"` or `"file://"`, but if a relative path was provided,
	 * we would again assume that it is relative to the current working directory.
	*/
	path?: AbsolutePath

	/** TODO: define how the file should bundle its dependencies:
	 * - `"bundle"` | `undefined`: the file will reference its entry points will be bundled as separate files, inheriting the basename of the importer javascript.
	 * - `"inject"`: any referenced files via `<script src="./file.js">` or `<link rel="stylesheet" href="./file.css">` will get injected be bundled into a string literal, which will then get injected into your html `document`'s head as a `<style>` element.
	 * - `"inject-link"`: similar to `"bundle"`, but will also inject a `<link>` element into your `document`'s head that link's to the output bundled file.
	*/
	mode?: "bundle" | "inject" | "inject-link"
}

/** the base class for creating custom loaders for any file type that is natively unsupported by `esbuild`.
 * - each loader class handles one type of new file type.
 * - each loader instance handles one file.
*/
abstract class GenericLoader {
	public disposed: boolean = false

	constructor(
		public content: string,
		public config: GenericLoaderConfig,
	) { }

	abstract parseToJs(): Promise<string>

	abstract unparseFromJs(js_content: string): Promise<string>

	/** dispose the contents of this loader, and label it as no longer useable.
	 * this will help save memory for large builds.
	*/
	dispose() {
		this.content = ""
		this.disposed = true
	}
}

interface ScriptWrappedContent {
	importKeys: string[]
	content: string
}

const
	imports_beginning_marker = "globalThis.start_of_imports()",
	imports_ending_marker = "globalThis.end_of_imports()",
	import_statements_block_regex = new RegExp(
		escapeStringForRegex(imports_beginning_marker)
		+ `(?<importStatements>.*)`
		+ escapeStringForRegex(imports_ending_marker),
		"gs",
	),
	import_statement_regex = new RegExp("await\\s+import\\(\\s*\"(?<importPath>.*?)\"\\s*\\)", "g")

/** dataflow:
 * 
 * `parseDeps` -> `parseToJs` -> `esbuild.build` -> `unparseFromJs` -> `unparseDeps`
 * 
 * types of dependencies:
 * - inline: `dep-inline://` namespace
 * - bundleable link: `dep-link://` namespace
 * - external link: `dep-external://` namespace, or it can be left unparsed
*/
// export class BaseLoader extends GenericLoader {
export class HtmlLoader extends GenericLoader {
	depsStorage?: TemplateKvStorage

	/** parse the dependencies of the content, and return it as an array.
	 * you will probably also want to stow away your intermediate representation of the `content` with the dependencies
	 * stripped away (or replaced with a references) as a member of the instance of your class, so that it can be loaded
	 * again by `unparseDeps` to merge the dependencies back into th
	*/
	async parseDeps(): Promise<TemplateKvStorage> {
		if (this.depsStorage) { return this.depsStorage }
		let counter = 0
		// parse html deps from content and then replace content with the template
		const
			{ content, config: { path = "./index.html" } } = this,
			dir_url = getDirUrlFromFile(path),
			doc = new DOMParser().parseFromString(content, "text/html"),
			depsStorage = new TemplateKvStorage()

		const
			selector = "script[src]",
			attribute = "src"

		for (const elem of doc.querySelectorAll(selector) as unknown as Iterable<Element>) {
			// below, `dir_url` is used as the base path if `elem.getAttribute(attribute)` is a relative link. but if it is absolute, then `html_dir_url` will not be part of the base path.
			const
				resource_url: URL = resolveAsUrl(elem.getAttribute(attribute)!, dir_url),
				resource_key = `dep-link://${counter++}`,
				attribute_template = depsStorage.add(resource_key, resource_url.href)
			elem.setAttribute(attribute, attribute_template)
		}

		// TODO: purge
		console.log(depsStorage.storage)

		this.content = stringifyHtmlDocument(doc as any)
		return (this.depsStorage = depsStorage)
	}

	async unparseDeps(): Promise<string> {
		const
			depsStorage = await this.parseDeps(),
			unparsed_content = depsStorage.applyKv(this.content)
		this.content = unparsed_content
		return unparsed_content
	}

	override async parseToJs(): Promise<string> {
		const
			depsStorage = await this.parseDeps(),
			deps_js_string = depsStorage.entries().map(([import_key, import_path]) => {
				return ""
					+ `importKeys.push(${escapeString(import_key)})\n`
					+ `await import(${escapeString(import_path)})\n`
			}).join("")
		return `
export const importKeys = []
globalThis.start_of_imports()
${deps_js_string}
globalThis.end_of_imports()
export const content = ` + stringToJsEvalString(this.content) + "\n"
	}

	override async unparseFromJs(js_content: string): Promise<string> {
		const
			depsStorage = await this.parseDeps(),
			import_statements_block = js_content.matchAll(import_statements_block_regex).map((match) => {
				return match.groups?.importStatements ?? ""
			}).toArray().join("\n"),
			import_paths = import_statements_block.matchAll(import_statement_regex).map((match) => {
				return match.groups?.importPath ?? ""
			}).toArray(),
			js_content_without_imports = js_content.replaceAll(import_statement_regex, ""),
			js_content_without_import_markers = js_content_without_imports
				.replaceAll(imports_beginning_marker, "")
				.replaceAll(imports_ending_marker, ""),
			js_blob = new Blob([js_content_without_import_markers], { type: "text/javascript" }),
			js_blob_url = URL.createObjectURL(js_blob),
			{
				content: content_template,
				importKeys: import_keys,
			} = await import(js_blob_url) as ScriptWrappedContent,
			number_of_imports = import_keys.length
		if (number_of_imports !== import_paths.length) {
			throw new Error("encountered a mismatch between number of imported dependencies, and number of keys assigned to dependencies")
		}
		for (let i = 0; i < number_of_imports; i++) {
			const
				key = import_keys[i],
				path = import_paths[i]
			depsStorage.add(key, path)
		}
		// const output_content = depsStorage.applyKv(content_template) // ideally I should be calling `this.unparseDeps` here instead of doing the procedure myself. but then, I'll have to assign `this.content = content_template` for that.
		this.content = content_template
		return this.unparseDeps()
	}

	override dispose(): void {
		this.depsStorage = undefined
		super.dispose()
	}
}
