import { b as InteractiveCapabilities } from '../interactive-capabilities-DqY-QM6X.js';
import * as ai from 'ai';
import { d as DiagramListItem, i as GetSyntaxResult, g as GetExamplesResult, V as ValidateDslResult, R as RenderDslResult, I as InspectDiagramResult, c as DiagramEdit, A as ApplyDiagramEditsResult } from '../tools-DrSNczdx.js';
import '../types-Bgj27ejP.js';
import '../api-D_Lu9-oC.js';

declare const schematexTools: {
    readonly listDiagrams: ai.Tool<Record<string, never>, DiagramListItem[]>;
    readonly getSyntax: ai.Tool<{
        type: string;
        detail?: "canonical" | "reference";
    }, GetSyntaxResult>;
    readonly getExamples: ai.Tool<{
        type: string;
        limit?: number;
        preferFeatured?: boolean;
        maxComplexity?: number;
    }, GetExamplesResult>;
    readonly validateDsl: ai.Tool<{
        type?: string;
        dsl: string;
    }, ValidateDslResult>;
    readonly renderDsl: ai.Tool<{
        type?: string;
        dsl: string;
        theme?: string;
        padding?: number;
    }, RenderDslResult>;
    readonly getDiagramCapabilities: ai.Tool<{
        type: string;
    }, InteractiveCapabilities>;
    readonly inspectDiagram: ai.Tool<{
        type?: string;
        dsl: string;
    }, InspectDiagramResult>;
    readonly applyDiagramEdits: ai.Tool<{
        type?: string;
        dsl: string;
        revision: number;
        edits: DiagramEdit[];
    }, ApplyDiagramEditsResult>;
};
type SchematexTools = typeof schematexTools;

export { type SchematexTools, schematexTools };
