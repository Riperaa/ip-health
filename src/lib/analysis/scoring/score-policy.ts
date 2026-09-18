import type { StatusTone } from "@/lib/status-colors";

export function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getScoreTone(score: number): StatusTone {
  if (score >= 80) {
    return "good";
  }

  if (score >= 60) {
    return "caution";
  }

  return "risk";
}

export function capScoreForEvidence(score: number, maxScore: number) {
  return Math.min(score, maxScore);
}
