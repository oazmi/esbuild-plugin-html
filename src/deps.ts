import { getUriScheme, resolvePathFactory } from "jsr:@oazmi/kitchensink@0.8.4/pathman"


export { DOMParser } from "jsr:@b-fuze/deno-dom@0.1.48"
export { object_entries, object_fromEntries, object_keys, object_values } from "jsr:@oazmi/kitchensink@0.8.4/builtin_aliases_deps"
export { getUriScheme, joinPaths, resolveAsUrl } from "jsr:@oazmi/kitchensink@0.8.4/pathman"
// TODO: in the future, we will have to wrap `getUriScheme` and export a different `getUriScheme` that understands our custom `inline://` uri-scheme

// below is a custom path segment's absoluteness test function that will identify all `UriScheme` segments that are not "relative" as absolute paths,
const absolute_path_segment_tester = (segment: string) => {
	return getUriScheme(segment) !== "relative"
}

export const
	getCwd = () => Deno.cwd(),
	resolvePath = resolvePathFactory(getCwd, absolute_path_segment_tester)
