import type { ResearchResult } from "./web-research.js";
import { selectEngine } from "../engine/factory.js";
import { logger } from "../util/logger.js";

export interface SynthesisInput {
  projectDescription: string;
  researchResults: ResearchResult[];
}

export interface SynthesisOutput {
  summary: string;
  actionItems: string[];
  recommendations: string[];
  risks: string[];
  timestamp: Date;
}

export async function synthesizeFindings(
  input: SynthesisInput,
  engineType: string,
  containerId: string,
  workspacePath: string,
): Promise<SynthesisOutput> {
  const engine = selectEngine(engineType);

  const researchSummaries = input.researchResults
    .map((r, i) => `### Research ${i + 1}: ${r.topic}\n${r.findings}`)
    .join("\n\n");

  const instruction = `You are synthesizing research findings for the following project:

${input.projectDescription}

Here are the research findings to synthesize:

${researchSummaries}

Please provide:

## Executive Summary
[2-3 paragraph synthesis of all findings]

## Action Items
[Numbered list of specific, actionable next steps]

## Recommendations
[Strategic recommendations based on the research]

## Risks & Concerns
[Potential risks or concerns identified in the research]`;

  const result = await engine.run({
    containerId,
    instruction,
    workspacePath,
  });

  logger.info("Research synthesis completed");

  return {
    summary: result.output,
    actionItems: [],
    recommendations: [],
    risks: [],
    timestamp: new Date(),
  };
}
