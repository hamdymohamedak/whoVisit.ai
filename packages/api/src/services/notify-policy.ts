import type { Confidence } from "../classification/source-registry.js";

const CONF_RANK: Record<Confidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export function meetsMinConfidence(
  actual: Confidence,
  minimum: string | null | undefined
): boolean {
  if (!minimum) return true;
  const min = minimum as Confidence;
  if (!(min in CONF_RANK)) return true;
  return CONF_RANK[actual] >= CONF_RANK[min];
}

export function shouldSendNotify(input: {
  eventType: string;
  sourceCategory: string;
  confidence: Confidence;
  notifyAiOnly: boolean;
  notifyMinConfidence: string | null;
  notifyConversions: boolean;
}): boolean {
  const { eventType } = input;
  if (eventType === "conversion") {
    return input.notifyConversions ?? true;
  }
  if (eventType !== "page_view" && eventType !== "session_start") {
    return false;
  }
  if (input.notifyAiOnly && input.sourceCategory !== "ai") {
    return false;
  }
  return meetsMinConfidence(input.confidence, input.notifyMinConfidence);
}
