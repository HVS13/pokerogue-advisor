import { getSnapshotContentKey } from "../core/snapshot-key.js";
import type { AdvisorRecommendation, AdvisorSnapshot } from "../core/types.js";

export interface AcceptanceEntry {
  sequence: number;
  recordedAt: number;
  snapshot: AdvisorSnapshot;
  recommendations: AdvisorRecommendation[];
}

export interface AcceptanceSession {
  format: "pokerogue-advisor-session";
  version: 1;
  exportedAt: number;
  entries: AcceptanceEntry[];
}

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class AcceptanceRecorder {
  private readonly entries: AcceptanceEntry[] = [];
  private lastSnapshotKey: string | undefined;
  private sequence = 0;

  constructor(private readonly maxEntries = 100) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("AcceptanceRecorder maxEntries must be a positive integer.");
    }
  }

  record(snapshot: AdvisorSnapshot, recommendations: AdvisorRecommendation[], recordedAt = Date.now()): boolean {
    if (snapshot.context === "idle") return false;

    const snapshotKey = getSnapshotContentKey(snapshot);
    if (snapshotKey === this.lastSnapshotKey) return false;
    this.lastSnapshotKey = snapshotKey;

    this.sequence += 1;
    this.entries.push({
      sequence: this.sequence,
      recordedAt,
      snapshot: clonePlain(snapshot),
      recommendations: clonePlain(recommendations),
    });

    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    return true;
  }

  size(): number {
    return this.entries.length;
  }

  exportSession(exportedAt = Date.now()): AcceptanceSession {
    return {
      format: "pokerogue-advisor-session",
      version: 1,
      exportedAt,
      entries: clonePlain(this.entries),
    };
  }
}

export function serializeAcceptanceSession(session: AcceptanceSession): string {
  return `${JSON.stringify(session, null, 2)}\n`;
}
