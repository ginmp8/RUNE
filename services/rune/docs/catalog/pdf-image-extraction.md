# PDF image extraction

## Status

Implemented in RUNE 0.8.0.

## Behavior

When `pdfImport.extractImages` is true, supported image XObjects are published as standalone companion artifacts and embedded in semantic HTML. JPEG and JPEG 2000 streams retain their encoded representation. Eight-bit DeviceRGB, DeviceGray, and DeviceCMYK streams are converted to BMP.

The conversion report records artifact filename, media type, byte length, SHA-256, and source page. Unsupported color depths or filters are skipped with a warning instead of corrupting the output. Artifacts are downloadable from `/v1/renders/{id}/artifacts/{name}`.
