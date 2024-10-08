import { assertEquals } from "jsr:@std/assert"
import { parseHtmlInlinedDeps } from "../../src/html_deps_parser/inlined_deps_parser.ts"

const text_encoder = new TextEncoder()
const text_decoder = new TextDecoder()

// Unit Test 1: Inline JavaScript, CSS, and SVG parsing
Deno.test("parseHtmlInlinedDeps - Inline JavaScript, CSS, and SVG parsing", () => {
	const htmlContent = `<html>
	<head>
        <script type="module" defer="">console.log("Hello World")</script>
		<style>body { background-color: #fff; }</style>
	</head>
	<body>
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
			<circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red"></circle>
		</svg>
	</body>
</html>`

	const { depsInlined, html } = parseHtmlInlinedDeps(htmlContent, { path: "f:/path/to/index.html" })
	const rid1 = depsInlined.js[0].id
	const rid2 = depsInlined.css[0].id
	const rid3 = depsInlined.svg[0].id

	assertEquals(depsInlined.js.length, 1)
	assertEquals(text_decoder.decode(depsInlined.js[0].content).trim(), `console.log("Hello World")`)
	assertEquals(depsInlined.js[0].path, new URL("file:///f:/path/to/"))
	assertEquals(depsInlined.css.length, 1)
	assertEquals(text_decoder.decode(depsInlined.css[0].content).trim(), `body { background-color: #fff; }`)
	assertEquals(depsInlined.css[0].path, new URL("file:///f:/path/to/"))
	assertEquals(depsInlined.svg.length, 1)
	assertEquals(text_decoder.decode(depsInlined.svg[0].content).trim(), `<circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red"></circle>`)
	assertEquals(depsInlined.svg[0].path, new URL("file:///f:/path/to/"))
	assertEquals(rid1.startsWith("inline://"), true)
	assertEquals(rid2.startsWith("inline://"), true)
	assertEquals(rid3.startsWith("inline://"), true)
	assertEquals(rid1 !== rid2, true, "the id of each resource must be unique (non-repeating)")
	assertEquals(rid1 !== rid3, true, "the id of each resource must be unique (non-repeating)")
	assertEquals(rid2 !== rid3, true, "the id of each resource must be unique (non-repeating)")
	assertEquals(html.includes(`<res-inline type="module" defer="" rid="${rid1}"></res-inline>`), true)
	assertEquals(html.includes(`<res-inline rid="${rid2}"></res-inline>`), true)
	assertEquals(html.includes(`<res-inline xmlns="http://www.w3.org/2000/svg" viewbox="0 0 100 100" rid="${rid3}"></res-inline>`), true)
})

// Unit Test 2: Empty inline content and DTD tag preservation
Deno.test("parseHtmlInlinedDeps - Empty inline content and DTD tag preservation", () => {
	const htmlContent = `<!DOCTYPE html PUBLIC "HelloSystems" "IBM MainFrame">
<html>
	<head>
		<script></script>
		<style></style>
	</head>
</html>`
	// TODO: (PATCHED) the builtin `URL` class does not accept "jsr:@scope" as a valid base URL, however it does accept "jsr:/scope" as a valid base URL.
	// this is inline with the browsers' behavior, since it too also disallows such constructs. but I wonder if the deno team would be willing to support this.
	// NOTICE: notice the "../" appended to the html's file `path` this is because, by design, I have made sure that the `resolveAsUrl` function from `@oazmi/kitchensink` always leaves
	// a trailing slash, because it is usually the case that a relative path to a jsr endpoint is appended to the jsr path, instead of going up a directory.
	// but I could be wrong, so I might modify this behavior back to normal in the future.
	// examples of the behavior I am talking about:
	// - `URL("hello", "http://google.com/world").href === "http://google.com/hello"` (you'll also get the same behavior with `resolveAsUrl`)
	// - `URL("hello", "http://google.com/world/").href === "http://google.com/world/hello"` (you'll also get the same behavior with `resolveAsUrl`)
	// - `resolveAsUrl("hello", "jsr:google.com/world").href === "jsr:google.com/world/hello"`
	// - `resolveAsUrl("hello", "jsr:google.com/world/").href === "jsr:google.com/world/hello"`
	const { depsInlined, html } = parseHtmlInlinedDeps(htmlContent, { path: "jsr:@scope/lib@0.1.0/path/to/index.html/../" })
	const rid1 = depsInlined.js[0].id
	const rid2 = depsInlined.css[0].id

	assertEquals(depsInlined.js.length, 1)
	assertEquals(text_decoder.decode(depsInlined.js[0].content), "")
	assertEquals(depsInlined.js[0].path, new URL("jsr:@scope/lib@0.1.0/path/to/"))
	assertEquals(depsInlined.css.length, 1)
	assertEquals(text_decoder.decode(depsInlined.css[0].content), "")
	assertEquals(depsInlined.css[0].path, new URL("jsr:@scope/lib@0.1.0/path/to/"))
	assertEquals(html.includes(`<res-inline rid="${rid1}"></res-inline>`), true)
	assertEquals(html.includes(`<res-inline rid="${rid2}"></res-inline>`), true)
	assertEquals(html.startsWith(`<!DOCTYPE html PUBLIC "HelloSystems" "IBM MainFrame">\n`), true, "the DTD doctype string was not preserved")
})

// Unit Test 3: No inline dependencies
Deno.test("parseHtmlInlinedDeps - No inline dependencies", () => {
	const htmlContent = `<!DOCTYPE html>
<html>
	<head>
		<title>Test Page</title>
	</head>
	<body>
		<p>No inlined scripts or styles here.</p>
	</body>
</html>`

	const result = parseHtmlInlinedDeps(htmlContent, { path: "f:/path/to/index.html" })

	assertEquals(result.depsInlined.js.length, 0)
	assertEquals(result.depsInlined.css.length, 0)
	assertEquals(result.depsInlined.svg.length, 0)
	assertEquals(result.html.includes("<res-inline"), false)
})
