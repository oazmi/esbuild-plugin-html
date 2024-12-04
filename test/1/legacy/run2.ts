import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.0"
import { cssPlugin } from "jsr:@oazmi/esbuild-plugin-css@0.1.2"
import esbuild from "npm:esbuild"
import { resolveAsUrl, resolvePath } from "../../../src/deps.ts"
import { htmlPlugin } from "../../../src/legacy/plugin.ts"


const
	this_dir_path = resolvePath(import.meta.url, "./"),
	html_file_path = resolveAsUrl("./index.html", this_dir_path),
	html_file2_path = resolveAsUrl("./index2.html", this_dir_path)

const outputs = await esbuild.context({
	absWorkingDir: (new URL(this_dir_path).pathname).slice(1),
	format: "esm",
	entryPoints: [
		html_file_path.pathname.slice(1),
		html_file2_path.pathname.slice(1),
		// "./index.ts",
		// "./index2.ts",
	],
	minify: true,
	outdir: "./dist/",
	splitting: true,
	bundle: true,
	write: true,
	plugins: [htmlPlugin(), cssPlugin({ mode: "bundle" }), ...denoPlugins()],
})
// console.log(outputs)

await outputs.rebuild()
