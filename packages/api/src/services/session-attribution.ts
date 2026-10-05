import type { ClassificationResult, Confidence } from "../classification/source-registry.js";
import type { sessions } from "../db/schema.js";

type SessionRow = typeof sessions.$inferSelect;

export function classificationFromSession(row: SessionRow): ClassificationResult {
  return {
    trafficKind: row.trafficKind as "human" | "bot",
    sourceCategory: row.sourceCategory as ClassificationResult["sourceCategory"],
    sourcePlatform: row.sourcePlatform,
    confidence: row.confidence as Confidence,
    confidenceScore:
      row.confidence === "high"
        ? 0.95
        : row.confidence === "medium"
          ? 0.7
          : row.confidence === "low"
            ? 0.35
            : 0.2,
    searchQuery: null,
    botName: row.trafficKind === "bot" ? row.sourcePlatform : null,
  };
}
