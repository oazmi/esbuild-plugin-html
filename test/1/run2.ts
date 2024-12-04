import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.0"
import { cssPlugin } from "jsr:@oazmi/esbuild-plugin-css@0.1.2"
import esbuild from "npm:esbuild"
import { writeOutputFiles } from "jsr:@oazmi/esbuild-generic-loader/fs"
import { commonPathReplace, relativePath, resolveAsUrl, resolvePath } from "../../src/deps.ts"
import { htmlPlugin } from "../../src/plugin.ts"


const
	url_to_href = (url: URL) => (url.href),
	cwd_url = resolveAsUrl("./", resolvePath()),
	this_dir_url = resolveAsUrl("./", import.meta.url),
	working_dir_path = relativePath(url_to_href(cwd_url), url_to_href(this_dir_url)),
	[
		this_dir_path,
		html_file_path,
		html_file2_path,
	] = commonPathReplace([
		this_dir_url,
		resolveAsUrl("./index.html", this_dir_url),
		resolveAsUrl("./index2.html", this_dir_url),
	].map(url_to_href), "./")

const outputs = await esbuild.build({
	absWorkingDir: resolvePath(working_dir_path),
	format: "esm",
	target: "esnext",
	platform: "browser",
	entryPoints: [html_file_path, html_file2_path],
	minify: true,
	outdir: "./dist/",
	splitting: true,
	bundle: true,
	write: false,
	metafile: true,
	assetNames: "assets/[name]-[hash]",
	chunkNames: "[ext]/[name]-[hash]",
	plugins: [htmlPlugin()] //, cssPlugin({ mode: "bundle" }), ...denoPlugins()],
})

// const js_compiled_text = outputs.outputFiles[0].text
// console.log(js_compiled_text)

// const html_compiled_text = await a.unparseFromJs(js_compiled_text)
// console.log(html_compiled_text)
// console.log(...outputs.outputFiles.map((v) => v.text + "\n\n\n"))
// console.log("%c" + `bundled html file: "0", path: "${html_in_js_compiled.path}"`, "color: green; font-weight: bold;")
// console.log(html_compiled_text)
outputs.outputFiles.forEach((js_file, index) => {
	console.log("%c" + `bundled js file: "${index}", path: "${js_file.path}"`, "color: green; font-weight: bold;")
	console.log(js_file.text)
})

await writeOutputFiles(outputs.outputFiles)

// PARTIALLY-DONE: the todo below was temporarily fixed by making the `meta.imports` property optional inside of `GenericLoader` when constructing.
//       this way, its methods become functionally pure, independent of `HtmlLoader`'s internal state (i.e. `HtmlLoader` is stateless).
// TODO: because the HtmlLoader is not preserved between builds, the META is lacking in info, which throws an error as a result.
//       we'll either need to disable meta mismatch checking, or introduce a new config option for disabling it, or change our approach and actually preserve the loader associated with each file.
