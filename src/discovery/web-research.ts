import { selectEngine } from "../engine/factory.js";
import { logger } from "../util/logger.js";

export interface ResearchQuery {
  topic: string;
  questions: string[];
  depth?: "quick" | "thorough";
}

export interface ResearchResult {
  topic: string;
  findings: string;
  sources: string[];
  timestamp: Date;
}

export async function conductWebResearch(
  query: ResearchQuery,
  engineType: string,
  sandboxId: string,
  workspacePath: string,
): Promise<ResearchResult> {
  const engine = selectEngine(engineType);

  const instruction = buildResearchPrompt(query);

  const result = await engine.run({
    sandboxId,
    instruction,
    workspacePath,
  });

  logger.info({ topic: query.topic }, "Web research completed");

  return {
    topic: query.topic,
    findings: result.output,
    sources: extractSources(result.output),
    timestamp: new Date(),
  };
}

function buildResearchPrompt(query: ResearchQuery): string {
  const questions = query.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  const depth = query.depth === "thorough"
    ? "Be thorough and comprehensive. Search multiple sources and cross-reference."
    : "Provide a quick overview with key findings.";

  return `Research the following topic: ${query.topic}

Answer these questions:
${questions}

${depth}

Format your response as:
## Findings
[Your research findings organized by question]

## Sources
[List all URLs and sources consulted]

## Key Takeaways
[3-5 bullet points with the most important insights]`;
}

function extractSources(output: string): string[] {
  const urlPattern = /https?:\/\/[^\s)>\]]+/g;
  const matches = output.match(urlPattern);
  return matches ? [...new Set(matches)] : [];
}
