import { S as SchematexConfig } from './api-Dhy5_P92.cjs';
export { r as render, b as renderPreview, c as renderResult } from './api-Dhy5_P92.cjs';
import './types-Bgj27ejP.cjs';

/**
 * Browser-specific utilities for Schematex.
 *
 * These APIs require a DOM environment. Do not import in SSR/Node contexts.
 *
 * @example
 * ```ts
 * import { renderToElement, renderToContainer } from 'schematex/browser';
 *
 * const svg = renderToElement('genogram\n  alice [female]');
 * document.getElementById('diagram')!.appendChild(svg);
 * ```
 */

/**
 * Render DSL text to a live `SVGSVGElement` ready to insert into the DOM.
 */
declare function renderToElement(text: string, config?: SchematexConfig): SVGSVGElement;
/**
 * Render a live SVG element for an editing/AI-preview surface.
 *
 * Invalid DSL is represented as a diagnostic SVG instead of an empty surface.
 */
declare function renderPreviewToElement(text: string, config?: SchematexConfig): SVGSVGElement;
/**
 * Render DSL text and inject SVG into a container element (replaces innerHTML).
 */
declare function renderToContainer(text: string, container: Element, config?: SchematexConfig): void;
/** Replace a preview container with an SVG or a visible diagnostic fallback. */
declare function renderPreviewToContainer(text: string, container: Element, config?: SchematexConfig): void;

export { SchematexConfig, renderPreviewToContainer, renderPreviewToElement, renderToContainer, renderToElement };
