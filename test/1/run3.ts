import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.0"
import htmlPlugin from "npm:@chialab/esbuild-plugin-html"
import { Build } from "npm:@chialab/esbuild-rna"
import esbuild from "npm:esbuild"
import { resolveAsUrl, resolvePath } from "../../src/deps.ts"
// import { htmlPlugin } from "../../src/plugin.ts"


const
	this_dir_path = resolvePath(import.meta.url, "./"),
	html_file_path = resolveAsUrl("./index.html", this_dir_path),
	html_file2_path = resolveAsUrl("./index2.html", this_dir_path)

const outputs = await esbuild.build({
	absWorkingDir: (new URL(this_dir_path).pathname).slice(1),
	format: "esm",
	entryPoints: [
		html_file_path.pathname.slice(1),
		html_file2_path.pathname.slice(1),
	],
	minify: true,
	outdir: "./dist/",
	splitting: true,
	bundle: true,
	write: true,
	assetNames: "assets/[name]-[hash]",
	chunkNames: "[ext]/[name]-[hash]",
	plugins: [htmlPlugin(), ...denoPlugins()],
})

console.log(outputs)
