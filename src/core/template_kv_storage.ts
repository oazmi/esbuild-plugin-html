/** a function that wraps a `key` string inside some templating brackets. */
export type WrapKeyFn = (key: string) => string

/** the default wrapping function wraps a "key" as the string "\\{key\\}". */
const default_wrap_fn: WrapKeyFn = (key: string) => ("\\\{" + key + "\\\}")

/** a storage for key value pairs, that can be applied onto a string template via the {@link applyKv} method. */
export class TemplateKvStorage {
	constructor(
		/**a function that wraps a `key` inside the templating brackets.
		 * 
		 * @defaultValue `(key: string) => "\\\{" + key + "\\\}"`
		*/
		private readonly wrap: WrapKeyFn = default_wrap_fn,
	) { }

	storage: Map<string, string> = new Map()

	/** add a new (or replace) key-value pair to the storage, and return back the `key` wrapped inside of the template literal. */
	add(key: string, value: string): string {
		this.storage.set(key, value)
		return this.wrap(key)
	}

	keys(): string[] { return [...this.storage.keys()] }

	values(): string[] { return [...this.storage.values()] }

	entries(): Array<[key: string, value: string]> { return [...this.storage.entries()] }

	/** apply the current key-value pairs to the provided template string.
	 * note that this function is not built with efficiency, since it does a `replaceAll` over the entirety of the content for each key-value pair.
	*/
	applyKv(content: string): string {
		for (const [key, value] of this.entries()) {
			// TODO: consider whether or not it would be necessary to do `value.toString()` if we accept non-string `value`s in the future.
			content = content.replaceAll(this.wrap(key), value)
		}
		return content
	}
}
