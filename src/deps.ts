import { forbiddenBaseUriSchemes, getUriScheme, resolvePathFactory, uriProtocolSchemeMap } from "jsr:@oazmi/kitchensink@0.8.5/pathman"


export { DOMParser } from "jsr:@b-fuze/deno-dom@0.1.48"
export { object_entries, object_fromEntries, object_keys, object_values, promise_all, json_parse, json_stringify } from "jsr:@oazmi/kitchensink@0.8.5/alias"
export { getUriScheme, joinPaths, relativePath, resolveAsUrl } from "jsr:@oazmi/kitchensink@0.8.5/pathman"
export { isArray, isString } from "jsr:@oazmi/kitchensink@0.8.5/struct"
export type * as esbuild from "npm:esbuild"

// DONE: in the future, we will have to wrap `getUriScheme` and export a different `getUriScheme` that understands our custom `inline://` uri-scheme
uriProtocolSchemeMap.push(
	["link://", "link" as any],
	["inline://", "inline" as any],
)
forbiddenBaseUriSchemes.push("link" as any, "inline" as any)

// below is a custom path segment's absoluteness test function that will identify all `UriScheme` segments that are not "relative" as absolute paths,
export const isAbsolutePath = (segment: string) => {
	return getUriScheme(segment) !== "relative"
}

export const
	getCwd = () => Deno.cwd(),
	resolvePath = resolvePathFactory(getCwd, isAbsolutePath)
