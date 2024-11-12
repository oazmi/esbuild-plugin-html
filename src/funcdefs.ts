import { resolveAsUrl, resolvePath } from "./deps.ts"


/** infer the directory path of some file as a url.
 * if no path to a file is provided, then the url of the current working directory will be given.
*/
export const getDirUrlFromFile = (file_path: string = "./file.txt"): URL => {
	// we don't simply do `resolvePath(file_path, "./")` because `resolvePath` is incapable of handling jsr/npm package names.
	// on the other hand, I've built `resolveAsUrl` such that it comprehends package names and understands what the "root" directory of a package is.
	return resolveAsUrl("./", resolvePath(file_path))
}
