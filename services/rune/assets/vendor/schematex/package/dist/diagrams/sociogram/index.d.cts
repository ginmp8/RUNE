import { j as LegendOverrides, D as DiagramPlugin } from '../../types-Bgj27ejP.cjs';

type SociogramLayout = "circular" | "force-directed" | "concentric";
type EdgeValence = "positive" | "negative" | "neutral";
type EdgeDirection = "one-way" | "mutual" | "undirected";
type NodeRole = "star" | "isolate" | "bridge" | "neglectee" | "rejected";
type SizingMode = "uniform" | "in-degree" | "betweenness";
type ColoringMode = "default" | "group" | "role";
interface SociogramNode {
    id: string;
    label?: string;
    group?: string;
    role?: NodeRole;
    size?: "small" | "medium" | "large";
    properties?: Record<string, string>;
}
interface SociogramEdge {
    from: string;
    to: string;
    direction: EdgeDirection;
    valence: EdgeValence;
    weight: number;
    label?: string;
}
interface SociogramGroup {
    id: string;
    label?: string;
    color?: string;
    members: string[];
}
interface SociogramConfig {
    layout: SociogramLayout;
    sizing: SizingMode;
    coloring: ColoringMode;
    highlight: string[];
}
interface SociogramAST {
    type: "sociogram";
    title?: string;
    config: SociogramConfig;
    nodes: SociogramNode[];
    edges: SociogramEdge[];
    groups: SociogramGroup[];
    legendOverrides?: LegendOverrides;
}
declare function parseSociogram(text: string): SociogramAST;

interface SociogramLayoutNode {
    node: SociogramNode;
    x: number;
    y: number;
    radius: number;
    computedRole?: NodeRole;
}
interface SociogramLayoutEdge {
    edge: SociogramEdge;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}
interface SociogramLayoutResult {
    width: number;
    height: number;
    nodes: SociogramLayoutNode[];
    edges: SociogramLayoutEdge[];
    ast: SociogramAST;
}
declare function layoutSociogram(ast: SociogramAST): SociogramLayoutResult;

declare function renderSociogram(layout: SociogramLayoutResult, options?: {
    theme?: string;
}): string;

declare const sociogram: DiagramPlugin;

export { layoutSociogram, parseSociogram, renderSociogram, sociogram };
