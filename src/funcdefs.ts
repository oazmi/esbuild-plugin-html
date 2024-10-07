import { getUriNamespace, pathResolve, resolveAsUrl } from "./deps.ts"

/** infer the directory path of some file as a url.
 * if no path to a file is provided, then the url of the current working directory will be given.
*/
export const getDirUrlFromFile = (file_path: string = "./file.txt"): URL => {
	const
		file_path_scheme = getUriNamespace(file_path),
		dir_url = resolveAsUrl("./",
			file_path_scheme === "relative" || file_path_scheme === "local"
				? pathResolve(file_path)
				: file_path,
		)
	return dir_url
}
