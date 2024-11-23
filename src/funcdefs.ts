import { isArray, isString, json_parse, json_stringify, object_entries, object_fromEntries, promise_all, resolveAsUrl, resolvePath, type esbuild } from "./deps.ts"


const
	escape_regex_chars_regex = /[.*+?^${}()|[\]\\]/g,
	escape_regex_for_string_raw = /[\$\`]/g

export const
	escapeString = json_stringify,
	unescapeString = json_parse,
	escapeStringForRegex = (str: string) => (str.replaceAll(escape_regex_chars_regex, "\\$&")),
	stringToJsEvalString = (str: string) => ("String.raw\`" + str.replaceAll(escape_regex_for_string_raw, "\\$&") + "\`")

/** convert a string to a regex pattern that only matches the given string literal.  */
export const stringLiteralToRegex = (str: string): RegExp => {
	return new RegExp("^" + escapeStringForRegex(str) + "$")
}

/** infer the directory path of some file as a url.
 * if no path to a file is provided, then the url of the current working directory will be given.
*/
export const getDirUrlFromFile = (file_path: string = "./file.txt"): URL => {
	// we don't simply do `resolvePath(file_path, "./")` because `resolvePath` is incapable of handling jsr/npm package names.
	// on the other hand, I've built `resolveAsUrl` such that it comprehends package names and understands what the "root" directory of a package is.
	return resolveAsUrl("./", resolvePath(file_path))
}

export type predictEsbuildOutputPathConfig = Omit<esbuild.BuildOptions, "bundle" | "write" | "metafile" | "entryPoints">
export type predictEsbuildOutputPathsConfig<
	T extends NonNullable<esbuild.BuildOptions["entryPoints"]>
> = Omit<esbuild.BuildOptions & { entryPoints: T }, "bundle" | "write" | "metafile">
type Inout = { in: string, out?: string }
type InoutList = Array<Inout>

const required_config: esbuild.BuildOptions = { bundle: false, write: false, metafile: true }

export const predictEsbuildOutputPath = async (
	build: typeof esbuild.build,
	config: predictEsbuildOutputPathConfig,
	entrypoint: string | Inout,
): Promise<string> => {
	const entryPoints = [entrypoint] as (string[] | Inout)
	const result = await build({
		...config,
		...required_config,
		entryPoints
	})
	const output_paths = object_entries(result.metafile!.outputs)
		.filter(([output_path, metadata]) => {
			return metadata.entryPoint !== undefined
		})
		.map(([output_path, metadata]) => (output_path))
	// if there is more than one output path that has a non-undefined `metadata.entryPoint`, then we've run into a problem,
	// because we now don't know which output path truly corresponds to our initial single input.
	if (output_paths.length !== 1) {
		throw new Error(`expected there to be exactly ONE output with \`metadata.entryPoint\`, but found amount: "${output_paths.length}"\n\tgiven entrypoint: "${entrypoint}"`)
	}
	return output_paths.pop()!
}

const entryPointsToInoutList = <
	T extends NonNullable<esbuild.BuildOptions["entryPoints"]>
>(entrypoints: T): InoutList => {
	if (!isArray(entrypoints)) {
		return object_entries(entrypoints).map(([input, output]) => ({
			in: input,
			out: output
		}))
	}
	return (entrypoints).map((entry: string | Inout) => (
		isString(entry)
			? { in: entry, out: undefined }
			: entry
	))
}

export const predictEsbuildOutputPaths = async <
	T extends NonNullable<esbuild.BuildOptions["entryPoints"]>
>(
	build: typeof esbuild.build,
	config: predictEsbuildOutputPathsConfig<T>,
): Promise<T> => {
	// the logic inside of this function is just for preserving the type of entry point `T` provided by the user,
	// and having the output also be of the same type.
	const
		{ entryPoints, ...rest_config } = config,
		entrypoints_is_record = !isArray(entryPoints),
		entry_points_list = entryPointsToInoutList(entryPoints),
		input_and_output_paths_promise = entry_points_list.map(async (entry: Inout): Promise<Required<Inout>> => {
			const
				entrypoint = entry.out ? entry as Required<Inout> : entry.in,
				output_path = await predictEsbuildOutputPath(build, rest_config, entrypoint)
			return {
				in: entry.in,
				out: output_path,
			}
		}),
		input_and_output_paths = await promise_all(input_and_output_paths_promise)
	if (entrypoints_is_record) {
		return object_fromEntries(input_and_output_paths.map(
			({ in: input_path, out: output_path }) => ([input_path, output_path])
		)) as T
	}
	return input_and_output_paths.map((input_and_output, index) => {
		return entry_points_list[index].out
			? input_and_output
			: input_and_output.out
	}) as T
}
