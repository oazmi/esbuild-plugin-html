import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.0"
import { HtmlLoader } from "../../../src/core/loader.ts"
import esbuild from "npm:esbuild"
import { resolveAsUrl, resolvePath } from "../../../src/deps.ts"
// import { htmlPlugin } from "../../../src/plugin.ts"


const
	this_dir_path = resolvePath(import.meta.url, "./"),
	html_file_path = resolveAsUrl("./index.html", this_dir_path),
	html_file2_path = resolveAsUrl("./index2.html", this_dir_path)

const a = new HtmlLoader(await (await fetch(html_file2_path)).text(), { path: (new URL(this_dir_path).pathname).slice(1) })
const js_txt = await a.parseToJs()

const outputs = await esbuild.build({
	absWorkingDir: (new URL(this_dir_path).pathname).slice(1),
	format: "esm",
	target: "esnext",
	platform: "browser",
	stdin: {
		contents: js_txt,
		loader: "ts",
		resolveDir: this_dir_path,
		sourcefile: html_file2_path.pathname.slice(1),
	},
	minify: true,
	outdir: "./dist/",
	splitting: true,
	bundle: true,
	write: false,
	assetNames: "assets/[name]-[hash]",
	chunkNames: "[ext]/[name]-[hash]",
	plugins: [...denoPlugins()],
})

const js_compiled_text = outputs.outputFiles[0].text
// console.log(js_compiled_text)

const html_compiled_text = await a.unparseFromJs(js_compiled_text)
console.log(html_compiled_text)
console.log(...outputs.outputFiles.slice(1).map((v) => v.text + "\n\n\n"))
