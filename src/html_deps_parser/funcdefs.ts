/** utility functions for this esbuild plugin.
 * 
 * @module
*/

/** copy the attributes of one `Element` to another. */
export const copyElementAttributes = (src_elem: Element, dst_elem: Element): typeof dst_elem => {
	const attrs: Array<Attr> = [...src_elem.attributes as any]
	attrs.forEach((attr) => { dst_elem.setAttribute(attr.name, attr.value ?? "") })
	return dst_elem
}

/** get the DTD string of an html document. you will need this function when trying to stringify and html `Document`,
 * since `Document.documentElement.outerHTML` does not contain the DTD string.
*/
export const getDocumentDtd = (doc: Document): string => {
	const doctype = doc.doctype
	if (!doctype) { return "" }
	const
		{ name = "html", publicId = "", systemId = "" } = doctype,
		// remember, empty strings are falsey, which is what we utilize to check whether they are empty or not
		public_str = publicId ? `PUBLIC "${publicId}"` : "",
		system_str = systemId
			? (publicId ? `"${systemId}"` : `SYSTEM "${systemId}"`)
			: ""
	return `<!DOCTYPE ${name} ${public_str} ${system_str}`.trimEnd() + ">"
}

/** stringify an html `Document`. */
export const stringifyHtmlDocument = (doc: Document): string => {
	const
		dtd_str = getDocumentDtd(doc),
		doc_str = doc.documentElement.outerHTML
	return dtd_str
		? dtd_str + "\n" + doc_str
		: doc_str
}
