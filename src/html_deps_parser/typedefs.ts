import type {HtmlDependencyLinked} from "./linked_deps_parser.ts"

/** a generic dependency of and HTML file. see the subtypes {@link HtmlDependencyLinked} and {@link HtmlInlinedDependency} for the concrete definitions. */
export interface HtmlDependency {
	/** within every html file, every direct dependency is given a unique resource `id`, so that we can identify it later on. <br>
	 * - for link referenced direct dependencies, we use the absolute path of the resource, including its uri scheme (like "http://", "jsr:", or "file://").
	 *   if two different direct link dependencies point towards the same resource, their `id` would be the same.
	 * - for inlined dependencies, we simply use the custom uri `inline://${res_number}`,
	 *   where`res_number` is a global number that increments each time a new inline dependency is introduced.
	*/
	id: string
}
