export type ExperimentConfidence = "high" | "medium" | "low" | "unusable";

export interface ExperimentHistoryEntry {
  id: number;
  timestamp: string;
  mode: string;
  scenarioId: string;
  scenarioLabel: string;
  score: number;
  confidence: ExperimentConfidence;
  usable: boolean;
  missedKeywords: string[];
  warnings: string[];
  transcript: string;
}

export interface ModeRecommendation {
  scenarioId: string;
  scenarioLabel: string;
  mode: string;
  score: number;
  confidence: ExperimentConfidence;
}

export function recommendBestModes(entries: ExperimentHistoryEntry[]): ModeRecommendation[] {
  const bestByScenario = new Map<string, ExperimentHistoryEntry>();

  for (const entry of entries) {
    if (!entry.usable) {
      continue;
    }

    const current = bestByScenario.get(entry.scenarioId);
    if (!current || entry.score > current.score) {
      bestByScenario.set(entry.scenarioId, entry);
    }
  }

  return [...bestByScenario.values()]
    .sort((left, right) => left.scenarioLabel.localeCompare(right.scenarioLabel))
    .map((entry) => ({
      scenarioId: entry.scenarioId,
      scenarioLabel: entry.scenarioLabel,
      mode: entry.mode,
      score: entry.score,
      confidence: entry.confidence,
    }));
}

export function historyToMarkdown(entries: ExperimentHistoryEntry[]): string {
  const lines = [
    "| Time | Scenario | Mode | Score | Confidence | Usable | Missed keywords | Warnings |",
    "| --- | --- | --- | ---: | --- | --- | --- | --- |",
  ];

  for (const entry of entries) {
    lines.push(
      [
        entry.timestamp,
        entry.scenarioLabel,
        entry.mode,
        String(entry.score),
        entry.confidence,
        entry.usable ? "yes" : "no",
        entry.missedKeywords.join(", ") || "none",
        entry.warnings.join(", ") || "none",
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    );
  }

  return lines.join("\n");
}

export function historyToJson(entries: ExperimentHistoryEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
