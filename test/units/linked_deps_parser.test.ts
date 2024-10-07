import { assertEquals } from "jsr:@std/assert"
import { parseHtmlLinkedDeps } from "../../src/html_deps_parser/linked_deps_parser.ts"

// Unit Test 1: Parsing relative and absolute JS dependencies
Deno.test("parseHtmlLinkedDeps - JS dependencies", () => {
	const htmlContent = `<html>
	<head>
		<script src="./app.js"></script>
		<script src="https://cdn.example.com/lib.js"></script>
	</head>
</html>`

	const expectedDeps = {
		css: [], img: [], ico: [], js: [
			{ id: "file:///c:/path/to/app.js", url: new URL("file:///c:/path/to/app.js") },
			{ id: "https://cdn.example.com/lib.js", url: new URL("https://cdn.example.com/lib.js") }
		],
	}

	const { depsLinked, html } = parseHtmlLinkedDeps(htmlContent, { path: "c:/path/to/index.html" })

	assertEquals(depsLinked, expectedDeps, "the list of linked dependencies does not match expectation")
	assertEquals(html.includes(`<res-link rid="${expectedDeps.js[0].id}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<res-link rid="${expectedDeps.js[1].id}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<script src=`), false, "the original resource element still exists, but it was supposed to be replaced by the `<res-link>` element")
})

// Unit Test 2: Parsing icon and base64-encoded images and preserving attributes
Deno.test("parseHtmlLinkedDeps - Icon and base64 images and preserving attributes", () => {
	const extra_attributes = `rel="icon" width="128" style="background-color: red;"`
	const htmlContent = `<html>
	<head>
		<link ${extra_attributes} href="../assets/favicon.ico">
	</head>
	<body><div id="root">
		<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...">
	</div></body>
</html>`

	const expectedDeps = {
		js: [], css: [],
		img: [{ id: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...", url: new URL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...") }],
		ico: [{ id: "file:///z:/path/to/assets/favicon.ico", url: new URL("file:///z:/path/to/assets/favicon.ico") }],
	}

	const { depsLinked, html } = parseHtmlLinkedDeps(htmlContent, { path: "z:/path/to/pages/index.html" })

	assertEquals(depsLinked, expectedDeps, "the list of linked dependencies does not match expectation")
	assertEquals(html.includes(`<res-link ${extra_attributes} rid="${expectedDeps.ico[0].id}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<res-link rid="${expectedDeps.img[0].id}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<link`), false, "the original resource element still exists, but it was supposed to be replaced by the `<res-link>` element")
	assertEquals(html.includes(`<img`), false, "the original resource element still exists, but it was supposed to be replaced by the `<res-link>` element")
})

// Unit Test 3: No dependencies and DTD tag preservation
Deno.test("parseHtmlLinkedDeps - No dependencies", () => {
	const htmlContent = `<!DOCTYPE html PUBLIC "HelloSystems" "IBM MainFrame">
<html>
	<head>
		<title>Test Page</title>
	</head>
	<body>
		<p>No resources linked here.</p>
	</body>
</html>`

	const expectedDeps = { js: [], css: [], img: [], ico: [] }

	const { depsLinked, html } = parseHtmlLinkedDeps(htmlContent, { path: "/path/to/index.html" })

	assertEquals(depsLinked, expectedDeps, "the empty list of linked dependencies does not match expectation")
	assertEquals(html.includes("<res-link"), false, "there should have been no `<res-link>` resource elements, since there were no dependencies")
	assertEquals(html.startsWith(`<!DOCTYPE html PUBLIC "HelloSystems" "IBM MainFrame">\n`), true, "the DTD doctype string was not preserved")
})

// Unit Test 4: Mixed dependencies (JS, CSS, Image, and Icon)
Deno.test("parseHtmlLinkedDeps - Mixed dependencies", () => {
	const htmlContent = `<!DOCTYPE html>
<html>
	<head>
		<script src="./app.js"></script>
		<link rel="stylesheet" href="https://cdn.example.com/styles.css">
		<link rel="icon" href="https://example.com/favicon.ico">
	</head>
	<body>
		<img src="./logo.png">
	</body>
</html>`

	const expectedDeps = {
		js: [{ id: "file:///k:/path/to/app.js", url: new URL("file:///k:/path/to/app.js") }],
		css: [{ id: "https://cdn.example.com/styles.css", url: new URL("https://cdn.example.com/styles.css") }],
		img: [{ id: "file:///k:/path/to/logo.png", url: new URL("file:///k:/path/to/logo.png") }],
		ico: [{ id: "https://example.com/favicon.ico", url: new URL("https://example.com/favicon.ico") }],
	}

	const { depsLinked, html } = parseHtmlLinkedDeps(htmlContent, { path: "k:/path/to/index.html" })

	assertEquals(depsLinked, expectedDeps, "the empty list of linked dependencies does not match expectation")
	assertEquals(html.includes(`<res-link rid="${expectedDeps.js[0].id}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<res-link rel="stylesheet" rid="${expectedDeps.css[0].id}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<res-link rid="${expectedDeps.img[0].id}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<res-link rel="icon" rid="${expectedDeps.ico[0].id}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.startsWith(`<!DOCTYPE html>\n`), true, "the DTD doctype string was not preserved")
})
