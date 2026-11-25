/**
 * Browser export utilities for Schematex SVG output.
 *
 * All APIs require a browser DOM + Canvas environment.
 * For Node.js PNG generation, use sharp or puppeteer externally.
 *
 * @example
 * ```ts
 * import { render } from 'schematex';
 * import { svgToPngBlob, downloadBlob } from 'schematex/export';
 *
 * const svg = render('genogram\n  alice [female]');
 * const png = await svgToPngBlob(svg, { scale: 2 });
 * downloadBlob(png, 'diagram.png');
 * ```
 */
interface PngExportOptions {
    /** Pixel ratio multiplier. Default: 2 (retina/2×). */
    scale?: number;
    /** Background fill color. Default: null (transparent). Pass a color string (e.g. 'white') to fill. */
    background?: string | null;
}
/** Add an opaque white paint layer without disturbing SVG title/description metadata. */
declare function withWhiteSvgBackground(svgString: string): string;
/**
 * Convert an SVG string to a PNG Blob using Canvas.
 * Resolves at @2× by default for crisp retina output.
 */
declare function svgToPngBlob(svgString: string, options?: PngExportOptions): Promise<Blob>;
/**
 * Trigger a browser file download from a Blob.
 */
declare function downloadBlob(blob: Blob, filename: string): void;
/**
 * Open SVG in a print-ready popup and trigger the browser's print dialog
 * (allows Save as PDF via the OS print driver).
 */
declare function printSvgAsPdf(svgString: string, title?: string): void;

export { type PngExportOptions, downloadBlob, printSvgAsPdf, svgToPngBlob, withWhiteSvgBackground };
