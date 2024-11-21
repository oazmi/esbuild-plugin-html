import { esbuild, isAbsolutePath, resolveAsUrl, resolvePath } from "./deps.ts"
import { predictEsbuildOutputPaths } from "./funcdefs.ts"
import { type HtmlDependencyLinked, parseHtmlLinkedDeps, unparseHtmlLinkedDeps } from "./html_deps_parser/linked_deps_parser.ts"


const plugin_namespace = "oazmi-html"

export const htmlPluginSetup = (build: esbuild.PluginBuild) => {


	build.onResolve({ filter: /\.html$/ }, async (args: esbuild.OnResolveArgs) => {
		// `args.path` is absolute when the entity is an entry point
		// `args.path` is _possibly_ relative when the entity is imported by a another entity
		const { path, resolveDir, importer, kind } = args
		console.log("[oazmi-html-resolve]: args:", { path, resolveDir, importer, kind })
		if (args.kind !== "entry-point") { throw new Error("plugin has only been tested with entry point html files") }
		// const a = (await build.resolve("", {}))
		return {
			path: resolvePath(importer, path),
			namespace: plugin_namespace,
		}
	})

	build.onLoad({ filter: /.*/, namespace: plugin_namespace }, async (args: esbuild.OnLoadArgs) => {
		// `args.path` is absolute when the entity is an entry point
		// `args.path` is _possibly_ relative when the entity is imported by a another entity
		const
			{ path, pluginData } = args,
			path_url = resolveAsUrl(path),
			esbuild_initial_config = build.initialOptions
		// { loader: _loader, ...esbuild_initial_config } = build.initialOptions
		// TODO: think harder about whether it makes sense to separate the loader from the initial config when doing sub-builds
		// in fact, I think it's a bad idea, as the end user might be relying on it.
		console.log("[oazmi-html-load]: args:", { path, pluginData })
		const
			html_content = await (await fetch(path_url)).text(),
			{ html: link_stripped_html, depsLinked } = parseHtmlLinkedDeps(html_content, { path }),
			js_dep_inputs = depsLinked.js.map((dep) => (dep.url.href)),
			js_dep_outputs = await predictEsbuildOutputPaths(build.esbuild.build, {
				...esbuild_initial_config,
				entryPoints: js_dep_inputs,
			})
		console.log("[oazmi-html-load]: linked deps inputs:", js_dep_inputs)
		console.log("[oazmi-html-load]: linked deps outputs:", js_dep_outputs)
		const
			outputDepsLinked_js: HtmlDependencyLinked[] = depsLinked.js.map((dep, index) => {
				const js_dep_output = js_dep_outputs[index]
				return {
					id: dep.id,
					url: isAbsolutePath(js_dep_output)
						? resolveAsUrl(js_dep_output)
						: resolveAsUrl(js_dep_output, path_url)
				}
			}),
			outputDepsLinked = {
				...depsLinked,
				js: outputDepsLinked_js
			},
			output_html = unparseHtmlLinkedDeps(link_stripped_html, outputDepsLinked)

		const results = await build.esbuild.context({
			...esbuild_initial_config,
			entryPoints: js_dep_inputs,
			metafile: true,
			write: true,
		})
		// console.log("[oazmi-html-load]: metafile:", results.metafile)

		return {
			contents: output_html,
			loader: "copy",
		}
	})
}

export const htmlPlugin = (): esbuild.Plugin => ({
	name: "oazmi-html",
	setup: htmlPluginSetup,
})
