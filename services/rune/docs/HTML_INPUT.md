# HTML input

RUNE accepts an HTML fragment or a complete HTML document.

## Safe mode

Safe mode is the default. The body is sanitized, scripts are removed and the source head is not preserved. Use it for user-controlled content.

## Trusted mode

Trusted mode preserves controlled `<style>`, `<link>` and `<script>` content from the source `<head>`. It is intended only for HTML produced by a trusted system. Browser export still blocks network requests, so referenced resources must be embedded or supplied in the request.

A trusted document may expose additional asynchronous readiness through either form:

```html
<script>window.__RUNE_READY__ = Promise.resolve();</script>
```

```html
<script>window.__RUNE_READY__ = async () => { /* wait for the application */ };</script>
```

RUNE waits for this contract before images, fonts, DOM quietness and dimension stability are validated.

## Resources

Relative `src` and `href` values can be supplied through the request resource collection. RUNE embeds matching resources as data URIs before returning or exporting the document.
