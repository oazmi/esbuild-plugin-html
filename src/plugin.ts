import { ensureEndSlash, type esbuild, isAbsolutePath, joinPaths, object_entries, promise_all, resolveAsUrl, resolvePath, textEncoder } from "./deps.ts"
import { HtmlLoader } from "./loader.ts"


interface PluginData {
	originalNamespace: string
}

// TODO: unfortunately, we cannot use use namespaces with deno plugin, since 
const
	plugin_namespace = "oazmi-html",
	plugin_filter = /\.html$/

export const htmlPluginSetup = (build: esbuild.PluginBuild) => {
	// TODO: execute build.onStart() and ensure that splitting is enabled
	// TODO: I'm technically not using `HtmlLoader` as intended. it should be unique to each loaded file, but instead, I'm relying one it functional purilty to use it wherever.

	const
		{ absWorkingDir, outdir, outfile, entryPoints, write } = build.initialOptions,
		esbuild_namespaced_htmlEntryPoints: string[] = []

	build.onResolve({ filter: plugin_filter }, async (args: esbuild.OnResolveArgs) => {
		// `args.path` is absolute when the entity is an entry point
		// `args.path` is _possibly_ relative when the entity is imported by a another entity
		const
			{ path, resolveDir, importer, kind, namespace } = args,
			dir = isAbsolutePath(importer)
				? importer
				: joinPaths(ensureEndSlash(resolveDir), importer),
			resolved_path = joinPaths(dir, path),
			esbuild_meta_resolved_path = `${plugin_namespace}:${resolved_path}`
		console.log("[oazmi-html-resolve]: args:", { path, resolveDir, importer, kind })
		if (args.kind !== "entry-point") { throw new Error("plugin has only been tested with entry point html files") }
		esbuild_namespaced_htmlEntryPoints.push(esbuild_meta_resolved_path)
		return {
			path: resolved_path,
			namespace: plugin_namespace,
			pluginData: { originalNamespace: namespace } satisfies PluginData,
		}
	})

	// this `onResolve` removes/undoes the plugin namespace attached to whatever dependency imports that an html file requires.
	build.onResolve({ filter: /.*/, namespace: plugin_namespace }, async (args: esbuild.OnResolveArgs) => {
		const { path, pluginData, ...rest_args } = args
		rest_args.namespace = (pluginData as PluginData).originalNamespace
		return build.resolve(path, rest_args)
	})

	build.onLoad({ filter: /.*/, namespace: plugin_namespace }, async (args: esbuild.OnLoadArgs) => {
		// `args.path` is absolute when the entity is an entry point
		// `args.path` is _possibly_ relative when the entity is imported by a another entity
		const
			{ path, pluginData } = args,
			path_url = resolveAsUrl(resolvePath(path))
		console.log("[oazmi-html-load]: args:", { path, pluginData })
		const
			html_content = await (await fetch(path_url)).text(),
			html_loader = new HtmlLoader({ path, meta: false }),
			html_in_js = await html_loader.parseToJs(html_content)
		return {
			contents: html_in_js,
			loader: "ts",
			resolveDir: resolvePath(path, "./"),
			pluginData,
		}
	})

	build.onEnd(async (args) => {
		const
			abs_working_dir = resolvePath(absWorkingDir ? absWorkingDir : "./"),
			{ metafile, outputFiles } = args as Required<Partial<esbuild.BuildResult>>,
			esbuild_outputs = object_entries(metafile.outputs),
			output_html_filenames: string[] = esbuild_namespaced_htmlEntryPoints.map((namespaced_path): string => {
				/* note the following:
				 * - the path portion of `namespaced_path` is absolute
				 * - the `output_relative_path` provided in the metafile is relative to esbuild's working directory
				 * - the `outputFiles[number].path` property is an absolute path
				 * 
				 * here, we will convert all identified output html file (relative) paths in the metafile to absolute posix path (i.e. using the "/" dir separator)
				*/
				for (const [output_relative_path, meta] of esbuild_outputs) {
					if (meta.entryPoint === namespaced_path) {
						return resolvePath(abs_working_dir, output_relative_path)
					}
				}
				throw new Error(`unable to locate the output path of the namespaced html entry-point: "${namespaced_path}"`)
			})

		if (!write && outputFiles) {
			const output_html_file_indexes: number[] = []
			outputFiles.forEach((output_file, index) => {
				// even though `output_file.path` is an absolute path, I'm still resolving it with respect to `abs_working_dir` in order to futureproof it,
				// in case esbuild returns a relative path in the future.

				if (output_html_filenames.includes(resolvePath(abs_working_dir, output_file.path))) {
					output_html_file_indexes.push(index)
				}
			})
			if (output_html_file_indexes.length !== output_html_filenames.length) {
				throw new Error(`failed to locate some expected html entry-points in esbuild's virtual "outputFiles".
\texpected to find html file paths: "${output_html_filenames}"
\tbut did not find them in "outputFiles" paths: ${outputFiles.map((output_file) => (output_file.path))}`)
			}

			await promise_all(output_html_file_indexes.map(async (index) => {
				const
					{ text, path, hash } = outputFiles[index],
					new_path = path.replace(/\.(j|t)sx?$/, ".html"),
					bundled_html_text = await (new HtmlLoader({ meta: false })).unparseFromJs(text),
					bundled_html_content = textEncoder.encode(bundled_html_text)
				outputFiles[index] = {
					hash,
					path: new_path,
					contents: bundled_html_content,
					text: bundled_html_text,
				}
			}))
		}
	})
}

export const htmlPlugin = (): esbuild.Plugin => ({
	name: "oazmi-html",
	setup: htmlPluginSetup,
})
