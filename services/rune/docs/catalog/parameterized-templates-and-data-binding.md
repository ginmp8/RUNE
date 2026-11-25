# Parameterized Templates And Data Binding

The `template` source type uses stable `rune-template-v1` grammar with `strict=true` by default. Typed JSON paths preserve booleans, integers, decimals/currency, strings, arrays, objects, and schema-qualified date/time values. Locale and time zone are independent deterministic options.

Escaping is selected from the parsed destination context: Markdown, HTML text, HTML attributes, URLs, CSS, JSON, or plain text. Raw insertion requires a typed trusted value such as `$runeTrustedHtml` or `$runeTrustedMarkdown`; an ordinary string never becomes executable markup.

JSON Schema handling is bounded: remote references are rejected, supported drafts/formats are explicit, defaults and additional properties follow policy, and diagnostic counts are capped. Canonical template, data, schema, and partial hashes form one expansion identity reused by every selected output and composite part.

Cycles, depth, expanded bytes, instruction steps, and local/global loop counts fail closed. Expansion metadata records engine identity, timings, counts, digest, and redacted diagnostics.
