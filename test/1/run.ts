import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.0"
import { cssPlugin } from "jsr:@oazmi/esbuild-plugin-css@0.1.2"
import esbuild from "npm:esbuild"
import { resolveAsUrl, resolvePath } from "../../src/deps.ts"
import { predictEsbuildOutputPath, predictEsbuildOutputPaths } from "../../src/funcdefs.ts"
import { parseHtmlInlinedDeps } from "../../extra/html_deps_parser/inlined_deps_parser.ts"
import { parseHtmlLinkedDeps } from "../../extra/html_deps_parser/linked_deps_parser.ts"


const
	this_dir_path = resolvePath(import.meta.url, "./"),
	html_file_path = resolveAsUrl("./index.html", this_dir_path),
	html_content = await (await fetch(html_file_path)).text(),
	deps_linked = parseHtmlLinkedDeps(html_content, { path: html_file_path.href }),
	deps_inlined = parseHtmlInlinedDeps(html_content, { path: html_file_path.href })

const js_build_list = deps_linked.depsLinked.js.map((dep) => dep.url.href)
const css_build_list = deps_linked.depsLinked.css.map((dep) => dep.url.href)

if (false) {
	const build_result = await esbuild.build({
		absWorkingDir: (new URL(this_dir_path).pathname).slice(1),
		bundle: true,
		format: "esm",
		entryPoints: [...js_build_list, ...css_build_list],
		minify: true,
		outdir: "./dist/",
		splitting: true,
		plugins: [cssPlugin({ mode: "bundle" }), ...denoPlugins()],
		write: false,
		metafile: true,
	})

	// console.log(deps_linked.depsLinked.css[0].url.href)
	// console.log(new TextDecoder().decode(deps_inlined.depsInlined.js[0].content))

	console.log(build_result.outputFiles.map((out) => out.path))
	console.log(build_result.outputFiles.map((out) => out.text))
	console.log(build_result.metafile)
	// TODO: the `metafile` is especially deformed, and so it is hard to pin the output back to the original entryPoint
	// what we can do is compile/build each entry point individually (with bundle = false, and all of the plugins)
	// to figure out the exact name of the transformed `entryPoint` name in the output,
	// and then we do the actual compilation with all proper entry points together, and with the prior knowledge of the
	// name of each of the output.
	// this way, we will be able to inject the output name to the list of html dependencies.
}

if (false) {
	const plugins = [cssPlugin({ mode: "bundle" }), ...denoPlugins()]
	console.log(`name transformations made: entrypoint\t-->\toutput_path`)
	for (const entrypoint of [...js_build_list, ...css_build_list]) {
		const output_path = await predictEsbuildOutputPath(esbuild.build, {
			absWorkingDir: (new URL(this_dir_path).pathname).slice(1),
			format: "esm",
			minify: true,
			outdir: "./dist/",
			splitting: true,
			plugins,
		}, entrypoint)
		console.log(`${entrypoint}\t-->\t${output_path}`)
	}
}

const outputs = await predictEsbuildOutputPaths(esbuild.build, {
	absWorkingDir: (new URL(this_dir_path).pathname).slice(1),
	format: "esm",
	entryPoints: [
		...js_build_list,
		...css_build_list,
		{ in: js_build_list[0], out: "./js/lib.js" } as any,
		{ in: css_build_list[0], out: "./css/lib_style.css" } as any,
	],
	minify: true,
	outdir: "./dist/",
	splitting: true,
	plugins: [cssPlugin({ mode: "bundle" }), ...denoPlugins()],
})
console.log(outputs)
