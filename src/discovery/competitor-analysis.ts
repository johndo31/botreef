import { conductWebResearch, type ResearchResult } from "./web-research.js";
import { logger } from "../util/logger.js";

export interface CompetitorProfile {
  name: string;
  url?: string;
  description?: string;
}

export interface CompetitorAnalysisResult {
  competitors: CompetitorProfile[];
  analysis: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  timestamp: Date;
}

export async function analyzeCompetitors(
  productDescription: string,
  competitors: CompetitorProfile[],
  engineType: string,
  containerId: string,
  workspacePath: string,
): Promise<CompetitorAnalysisResult> {
  const competitorList = competitors
    .map((c) => `- ${c.name}${c.url ? ` (${c.url})` : ""}${c.description ? `: ${c.description}` : ""}`)
    .join("\n");

  const research = await conductWebResearch(
    {
      topic: `Competitive analysis for: ${productDescription}`,
      questions: [
        `What are the key features and pricing of these competitors?\n${competitorList}`,
        "What are the main strengths and weaknesses of each competitor?",
        "What market gaps or opportunities exist that competitors are not addressing?",
        "What is the overall market trend and direction?",
      ],
      depth: "thorough",
    },
    engineType,
    containerId,
    workspacePath,
  );

  logger.info({ competitorCount: competitors.length }, "Competitor analysis completed");

  return {
    competitors,
    analysis: research.findings,
    strengths: [],
    weaknesses: [],
    opportunities: [],
    timestamp: new Date(),
  };
}
