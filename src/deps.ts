import { forbiddenBaseUriSchemes, getUriScheme, resolvePathFactory, uriProtocolSchemeMap } from "jsr:@oazmi/kitchensink@0.8.5/pathman"


export { DOMParser } from "jsr:@b-fuze/deno-dom@0.1.48"
export { GenericLoader, zipArrays, zipArraysMapperFactory, type ContentDependencies, type GenericLoaderConfig } from "jsr:@oazmi/esbuild-generic-loader@0.1.1"
export { json_parse, json_stringify, object_entries, object_fromEntries, object_keys, object_values, promise_all } from "jsr:@oazmi/kitchensink@0.8.5/alias"
export { commonPathReplace, ensureEndSlash, getUriScheme, joinPaths, relativePath, resolveAsUrl } from "jsr:@oazmi/kitchensink@0.8.5/pathman"
export { isArray, isString } from "jsr:@oazmi/kitchensink@0.8.5/struct"
export type * as esbuild from "npm:esbuild"

/** flags used for minifying (or eliminating) debugging logs and asserts, when an intelligent bundler, such as `esbuild`, is used. */
export const enum DEBUG {
	LOG = 0,
	ASSERT = 1,
	ERROR = 1,
	PRODUCTION = 1,
	MINIFY = 1,
}

// DONE: in the future, we will have to wrap `getUriScheme` and export a different `getUriScheme` that understands our custom `inline://` uri-scheme
uriProtocolSchemeMap.push(
	["link://", "link" as any],
	["inline://", "inline" as any],
)
forbiddenBaseUriSchemes.push("link" as any, "inline" as any)

// below is a custom path segment's absoluteness test function that will identify all `UriScheme` segments that are not "relative" as absolute paths,
export const isAbsolutePath = (segment: string) => {
	const scheme = getUriScheme(segment) ?? "relative"
	return scheme !== "relative"
}

export const
	getCwd = () => Deno.cwd(),
	resolvePath = resolvePathFactory(getCwd, isAbsolutePath)

export const
	textEncoder = new TextEncoder(),
	textDecoder = new TextDecoder()
