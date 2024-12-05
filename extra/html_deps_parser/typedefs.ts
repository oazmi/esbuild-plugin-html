import type { HtmlDependencyLinked } from "./linked_deps_parser.ts"

/** a generic dependency of and HTML file. see the subtypes {@link HtmlDependencyLinked} and {@link HtmlInlinedDependency} for the concrete definitions. */
export interface HtmlDependency {
	/** within every html file, every direct dependency is given a unique resource `id`, so that we can identify it later on. <br>
	 * - for link referenced direct dependencies, we use the custom uri `link://${res_number}`,
	 *   where `res_number` is a global number that increments each time a new inline dependency is introduced.
	 * - for inlined dependencies, we use the custom uri `inline://${res_number}`,
	 *   where `res_number` is a global number that increments each time a new inline dependency is introduced.
	*/
	id: string
}
