import { assertEquals } from "jsr:@std/assert"
import { parseHtmlLinkedDeps, type HtmlLinkedDependencies } from "../../src/html_deps_parser/linked_deps_parser.ts"


// Unit Test 1: Parsing relative and absolute JS dependencies
Deno.test("parseHtmlLinkedDeps - JS dependencies", () => {
	const htmlContent = `<html>
	<head>
		<script src="./app.js"></script>
		<script src="https://cdn.example.com/lib.js"></script>
	</head>
</html>`

	const { depsLinked, html } = parseHtmlLinkedDeps(htmlContent, { path: "c:/path/to/index.html" })
	const rid1 = depsLinked.js[0].id
	const rid2 = depsLinked.js[1].id

	assertEquals(rid1.startsWith("link://"), true)
	assertEquals(rid2.startsWith("link://"), true)
	assertEquals(rid1 !== rid2, true, "the id of each resource must be unique (non-repeating)")

	const expectedDeps: HtmlLinkedDependencies = {
		css: [], img: [], ico: [], js: [
			{ id: rid1, url: new URL("file:///c:/path/to/app.js") },
			{ id: rid2, url: new URL("https://cdn.example.com/lib.js") }
		],
	}

	assertEquals(depsLinked, expectedDeps, "the list of linked dependencies does not match expectation")
	assertEquals(html.includes(`<script res-src-link="${rid1}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<script res-src-link="${rid2}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`src=`), false, "the original resource element's source attribute still exists, but it was supposed to be replaced by the `res-src-link` attribute")
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
		<img src="https://google.com/logo.svg">
	</div></body>
</html>`

	const { depsLinked, html } = parseHtmlLinkedDeps(htmlContent, { path: "z:/path/to/pages/index.html" })
	const rid1 = depsLinked.img[0].id
	const rid2 = depsLinked.img[1].id
	const rid3 = depsLinked.ico[0].id

	assertEquals(rid1.startsWith("link://"), true)
	assertEquals(rid2.startsWith("link://"), true)
	assertEquals(rid3.startsWith("link://"), true)
	assertEquals(rid1 !== rid2, true, "the id of each resource must be unique (non-repeating)")
	assertEquals(rid1 !== rid3, true, "the id of each resource must be unique (non-repeating)")
	assertEquals(rid2 !== rid3, true, "the id of each resource must be unique (non-repeating)")

	const expectedDeps: HtmlLinkedDependencies = {
		js: [], css: [],
		img: [
			{ id: rid1, url: new URL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...") },
			{ id: rid2, url: new URL("https://google.com/logo.svg") },
		],
		ico: [{ id: rid3, url: new URL("file:///z:/path/to/assets/favicon.ico") }],
	}

	assertEquals(depsLinked, expectedDeps, "the list of linked dependencies does not match expectation")
	assertEquals(html.includes(`<link ${extra_attributes} res-src-link="${rid3}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<img res-src-link="${rid1}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<img res-src-link="${rid2}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`href=`), false, "the original resource element's source attribute still exists, but it was supposed to be replaced by the `res-src-link` attribute")
	assertEquals(html.includes(`src=`), false, "the original resource element's source attribute still exists, but it was supposed to be replaced by the `res-src-link` attribute")
})

// Unit Test 3: No dependencies and DTD tag preservation
Deno.test("parseHtmlLinkedDeps - No dependencies and DTD tag preservation", () => {
	const htmlContent = `<!DOCTYPE html PUBLIC "HelloSystems" "IBM MainFrame">
<html>
	<head>
		<title>Test Page</title>
		<link rel="icon">
		<style></style>
		<script></script>
	</head>
	<body>
		<p>No resources linked here.</p>
		<img>
	</body>
</html>`

	const expectedDeps: HtmlLinkedDependencies = { js: [], css: [], img: [], ico: [] }

	const { depsLinked, html } = parseHtmlLinkedDeps(htmlContent, { path: "/path/to/index.html" })

	assertEquals(depsLinked, expectedDeps, "the empty list of linked dependencies does not match expectation")
	assertEquals(html.includes("res-src-link"), false, "there should have been no `res-src-link` resource element attributes, since there were no linked dependencies")
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

	const { depsLinked, html } = parseHtmlLinkedDeps(htmlContent, { path: "k:/path/to/index.html" })
	const rid1 = depsLinked.js[0].id
	const rid2 = depsLinked.css[0].id
	const rid3 = depsLinked.img[0].id
	const rid4 = depsLinked.ico[0].id

	const expectedDeps: HtmlLinkedDependencies = {
		js: [{ id: rid1, url: new URL("file:///k:/path/to/app.js") }],
		css: [{ id: rid2, url: new URL("https://cdn.example.com/styles.css") }],
		img: [{ id: rid3, url: new URL("file:///k:/path/to/logo.png") }],
		ico: [{ id: rid4, url: new URL("https://example.com/favicon.ico") }],
	}

	assertEquals(depsLinked, expectedDeps, "the empty list of linked dependencies does not match expectation")
	assertEquals(html.includes(`<script res-src-link="${rid1}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<link rel="stylesheet" res-src-link="${rid2}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<img res-src-link="${rid3}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.includes(`<link rel="icon" res-src-link="${rid4}">`), true, "a placeholder reference to the linked resource was not added")
	assertEquals(html.startsWith(`<!DOCTYPE html>\n`), true, "the DTD doctype string was not preserved")
})
