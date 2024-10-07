# @oazmi/esbuild-plugin-html

Use your html files as `entryPoints` of esbuild, and have this plugin parse all of their dependencies (js, ts, css, images, and more), and bundle them together with optional code splitting. <br>
Works in `Browser` and `Deno` environments, so long as `wasm` is available, since it relies on [`jsr:@b-fuze/deno-dom`](https://github.com/b-fuze/deno-dom) for parsing html files.

## Super Mandatory Example

```html
<!DOCTYPE html>
<!-- YOO! SUP MA GOOD MAN? -->
<head></head>
<!-- TODO -->
<body></body>
```
