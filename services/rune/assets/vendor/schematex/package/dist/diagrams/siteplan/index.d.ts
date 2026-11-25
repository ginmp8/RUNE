import { a as SourceRange, R as RenderConfig, D as DiagramPlugin } from '../../types-Bgj27ejP.js';

/**
 * Site plan / parcel layout — AST and layout types.
 *
 * Scope: presentation-grade property/site sketches for listings, proposals,
 * and early planning. Not survey-grade, CAD, or permit-ready.
 */
type SiteplanUnit = "ft" | "m";
type SiteplanLineRole = "setback" | "easement" | "fence" | "utility" | "frontage" | "dimension" | "boundary";
type SiteplanPolygonRole = "parcel" | "structure" | "zone" | "landscape" | "parking";
type SiteplanPathRole = "road" | "driveway" | "walkway" | "trail";
type SiteplanMarkerKind = "tree" | "car" | "pin" | "entry" | "hydrant" | "well";
interface Point {
    x: number;
    y: number;
}
interface SiteplanPolygon {
    role: SiteplanPolygonRole;
    id: string;
    label?: string;
    points: Point[];
    pointSourceRanges?: SourceRange[];
    fill?: string;
    line?: number;
}
interface SiteplanPath {
    role: SiteplanPathRole;
    id: string;
    label?: string;
    points: Point[];
    pointSourceRanges?: SourceRange[];
    width: number;
    line?: number;
}
interface SiteplanLine {
    role: SiteplanLineRole;
    id: string;
    label?: string;
    points: Point[];
    pointSourceRanges?: SourceRange[];
    line?: number;
}
interface SiteplanMarker {
    kind: SiteplanMarkerKind;
    id: string;
    at: Point;
    atSourceRange?: SourceRange;
    size: number;
    label?: string;
    rotate: number;
    line?: number;
}
interface SiteplanCallout {
    label: string;
    at: Point;
    to: Point;
    atSourceRange?: SourceRange;
    toSourceRange?: SourceRange;
    line?: number;
}
interface SiteplanDimension {
    label: string;
    from: Point;
    to: Point;
    fromSourceRange?: SourceRange;
    toSourceRange?: SourceRange;
    line?: number;
}
interface SiteplanAst {
    type: "siteplan";
    title: string;
    titleSourceRange?: SourceRange;
    unit: SiteplanUnit;
    north?: number;
    scale?: number;
    legend: boolean;
    polygons: SiteplanPolygon[];
    paths: SiteplanPath[];
    lines: SiteplanLine[];
    markers: SiteplanMarker[];
    callouts: SiteplanCallout[];
    dimensions: SiteplanDimension[];
}
type SiteplanLayoutPolygon = SiteplanPolygon;
type SiteplanLayoutPath = SiteplanPath;
type SiteplanLayoutLine = SiteplanLine;
type SiteplanLayoutMarker = SiteplanMarker;
type SiteplanLayoutCallout = SiteplanCallout;
type SiteplanLayoutDimension = SiteplanDimension;
interface SiteplanLegendItem {
    key: string;
    label: string;
}
interface SiteplanLayoutResult {
    title: string;
    titleSourceRange?: SourceRange;
    unit: SiteplanUnit;
    north?: number;
    scale?: number;
    legend: boolean;
    polygons: SiteplanLayoutPolygon[];
    paths: SiteplanLayoutPath[];
    lines: SiteplanLayoutLine[];
    markers: SiteplanLayoutMarker[];
    callouts: SiteplanLayoutCallout[];
    dimensions: SiteplanLayoutDimension[];
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
    warnings: string[];
    legendItems: SiteplanLegendItem[];
}

declare class SiteplanParseError extends Error {
    readonly line: number;
    constructor(message: string, line: number);
}
declare function parseSiteplan(text: string): SiteplanAst;

declare function layoutSiteplan(ast: SiteplanAst): SiteplanLayoutResult;
declare function formatSiteLength(n: number, unit: "ft" | "m"): string;

declare function renderSiteplan(text: string, config?: RenderConfig): string;
declare function renderSiteplanLayout(lay: SiteplanLayoutResult, config?: RenderConfig): string;

declare const siteplan: DiagramPlugin;

export { type Point, type SiteplanAst, type SiteplanCallout, type SiteplanDimension, type SiteplanLayoutCallout, type SiteplanLayoutDimension, type SiteplanLayoutLine, type SiteplanLayoutMarker, type SiteplanLayoutPath, type SiteplanLayoutPolygon, type SiteplanLayoutResult, type SiteplanLegendItem, type SiteplanLine, type SiteplanLineRole, type SiteplanMarker, type SiteplanMarkerKind, SiteplanParseError, type SiteplanPath, type SiteplanPathRole, type SiteplanPolygon, type SiteplanPolygonRole, type SiteplanUnit, formatSiteLength, layoutSiteplan, parseSiteplan, renderSiteplan, renderSiteplanLayout, siteplan };
