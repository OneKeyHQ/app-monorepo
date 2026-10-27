export type ICpuWatchdogReason =
  | 'sustained-high-cpu-severe'
  | 'sustained-high-cpu-mild'
  | 'unresponsive';

export const CPU_WATCHDOG_SAMPLE_INTERVAL_MS = 10_000;
export const CPU_WATCHDOG_STARTUP_GRACE_MS = 60_000;
export const CPU_WATCHDOG_SEVERE_THRESHOLD_PERCENT = 95;
export const CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES = 6;
export const CPU_WATCHDOG_MILD_THRESHOLD_PERCENT = 80;
export const CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES = 30;
export const CPU_WATCHDOG_HISTORY_SIZE = CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES;
export const CPU_WATCHDOG_RECOVERY_THRESHOLD_PERCENT = 50;
export const CPU_WATCHDOG_RECOVERY_SUSTAINED_SAMPLES = 6;
export const CPU_WATCHDOG_COOLDOWN_MS = 30 * 60_000;

const CPU_WATCHDOG_REASONS = new Set<ICpuWatchdogReason>([
  'sustained-high-cpu-severe',
  'sustained-high-cpu-mild',
  'unresponsive',
]);

const SEVERITY_RANK: Record<ICpuWatchdogReason, number> = {
  'sustained-high-cpu-mild': 1,
  'sustained-high-cpu-severe': 2,
  unresponsive: 3,
};

export function isCpuWatchdogReason(
  value: unknown,
): value is ICpuWatchdogReason {
  return (
    typeof value === 'string' &&
    CPU_WATCHDOG_REASONS.has(value as ICpuWatchdogReason)
  );
}

export type ICpuMetricInput = {
  pid: number;
  type: string;
  name?: string;
  percentCPUUsage: number;
  cumulativeCPUUsage?: number;
};

export type IAnnotatedCpuMetric = {
  pid: number;
  type: string;
  name?: string;
  electronPct: number;
  effectivePct: number;
  cum: number;
};

export type ICpuWatchdogFireEvent = {
  reason: ICpuWatchdogReason;
  pid?: number;
  cpuTrend?: number[];
  bypassCooldown?: boolean;
  episodeEscalated?: boolean;
};

type IPidEpisodeState = {
  activeHighestRank: number;
  recoverySamplesBelowThreshold: number;
  lastFiredAtByRank: Record<number, number>;
};

export class CpuWatchdogController {
  private readonly cpuHistoryByPid = new Map<number, number[]>();

  private readonly prevCumCpuByPid = new Map<number, number>();

  private readonly episodeByPid = new Map<number, IPidEpisodeState>();

  private lastSampleAt: number | null = null;

  private startedAt: number | null = null;

  private lastFiredAt = 0;

  start(now = Date.now()) {
    this.startedAt = now;
  }

  reset() {
    const previousLastFiredAt = this.lastFiredAt;
    this.lastFiredAt = 0;
    this.lastSampleAt = null;
    this.startedAt = null;
    this.cpuHistoryByPid.clear();
    this.prevCumCpuByPid.clear();
    this.episodeByPid.clear();
    return previousLastFiredAt;
  }

  private getOrCreateEpisode(pidKey: number): IPidEpisodeState {
    let state = this.episodeByPid.get(pidKey);
    if (!state) {
      state = {
        activeHighestRank: 0,
        recoverySamplesBelowThreshold: 0,
        lastFiredAtByRank: {},
      };
      this.episodeByPid.set(pidKey, state);
    }
    return state;
  }

  sampleMetrics(params: {
    metrics: ICpuMetricInput[];
    now?: number;
    ignoredTabPids?: ReadonlySet<number>;
  }): {
    wallDeltaSec: number;
    annotated: IAnnotatedCpuMetric[];
    sortedForLog: IAnnotatedCpuMetric[];
    eventsToFire: ICpuWatchdogFireEvent[];
    shouldLogTick: boolean;
  } {
    const now = params.now ?? Date.now();
    if (this.startedAt === null) {
      this.startedAt = now;
    }
    const wallDeltaSec =
      this.lastSampleAt === null
        ? CPU_WATCHDOG_SAMPLE_INTERVAL_MS / 1000
        : (now - this.lastSampleAt) / 1000;
    this.lastSampleAt = now;

    const hadPrevSampleByPid = new Set<number>(this.prevCumCpuByPid.keys());
    const annotated: IAnnotatedCpuMetric[] = params.metrics.map((m) => {
      const cum = m.cumulativeCPUUsage ?? 0;
      const prev = this.prevCumCpuByPid.get(m.pid);
      let effectivePercent = 0;
      if (prev !== undefined && wallDeltaSec > 0) {
        effectivePercent = ((cum - prev) / wallDeltaSec) * 100;
        if (effectivePercent < 0) effectivePercent = 0;
      }
      this.prevCumCpuByPid.set(m.pid, cum);
      return {
        pid: m.pid,
        type: m.type,
        name: m.name,
        electronPct: Number(m.percentCPUUsage.toFixed(2)),
        effectivePct: Number(effectivePercent.toFixed(1)),
        cum: Number(cum.toFixed(2)),
      };
    });

    const sortedForLog = [...annotated].toSorted(
      (a, b) => b.effectivePct - a.effectivePct,
    );

    const inStartupGrace = now - this.startedAt < CPU_WATCHDOG_STARTUP_GRACE_MS;
    const seenTabPids = new Set<number>();
    const eventsToFire: ICpuWatchdogFireEvent[] = [];
    let shouldLogTick = false;

    for (const a of annotated) {
      if (a.type === 'Tab') {
        if (a.effectivePct >= CPU_WATCHDOG_MILD_THRESHOLD_PERCENT) {
          shouldLogTick = true;
        }
        if (!params.ignoredTabPids?.has(a.pid)) {
          seenTabPids.add(a.pid);
          if (hadPrevSampleByPid.has(a.pid) && !inStartupGrace) {
            const history = this.cpuHistoryByPid.get(a.pid) ?? [];
            history.push(a.effectivePct);
            if (history.length > CPU_WATCHDOG_HISTORY_SIZE) {
              history.shift();
            }
            this.cpuHistoryByPid.set(a.pid, history);

            const episode = this.getOrCreateEpisode(a.pid);
            if (
              episode.activeHighestRank > 0 &&
              a.effectivePct < CPU_WATCHDOG_RECOVERY_THRESHOLD_PERCENT
            ) {
              episode.recoverySamplesBelowThreshold += 1;
              if (
                episode.recoverySamplesBelowThreshold >=
                CPU_WATCHDOG_RECOVERY_SUSTAINED_SAMPLES
              ) {
                episode.activeHighestRank = 0;
                episode.recoverySamplesBelowThreshold = 0;
              }
            } else if (
              a.effectivePct >= CPU_WATCHDOG_RECOVERY_THRESHOLD_PERCENT
            ) {
              episode.recoverySamplesBelowThreshold = 0;
            }

            const severeWindow = history.slice(
              -CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
            );
            const severe =
              severeWindow.length === CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES &&
              severeWindow.every(
                (v) => v > CPU_WATCHDOG_SEVERE_THRESHOLD_PERCENT,
              );
            if (severe) {
              const decision = this.evaluateTrigger({
                reason: 'sustained-high-cpu-severe',
                pid: a.pid,
                cpuTrend: severeWindow,
                now,
              });
              if (decision) {
                eventsToFire.push(decision);
              }
            } else {
              const mild =
                history.length === CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES &&
                history.every((v) => v > CPU_WATCHDOG_MILD_THRESHOLD_PERCENT);
              if (mild) {
                const decision = this.evaluateTrigger({
                  reason: 'sustained-high-cpu-mild',
                  pid: a.pid,
                  cpuTrend: [...history],
                  now,
                });
                if (decision) {
                  eventsToFire.push(decision);
                }
              }
            }
          }
        }
      }
    }

    for (const pid of this.cpuHistoryByPid.keys()) {
      if (!seenTabPids.has(pid)) {
        this.cpuHistoryByPid.delete(pid);
      }
    }
    for (const pid of this.prevCumCpuByPid.keys()) {
      if (!annotated.some((a) => a.pid === pid)) {
        this.prevCumCpuByPid.delete(pid);
      }
    }
    for (const pid of this.episodeByPid.keys()) {
      if (pid !== 0 && !annotated.some((a) => a.pid === pid)) {
        this.episodeByPid.delete(pid);
      }
    }

    return {
      wallDeltaSec,
      annotated,
      sortedForLog,
      eventsToFire,
      shouldLogTick,
    };
  }

  evaluateTrigger(params: {
    reason: ICpuWatchdogReason;
    pid?: number;
    cpuTrend?: number[];
    bypassCooldown?: boolean;
    now?: number;
  }): ICpuWatchdogFireEvent | null {
    const now = params.now ?? Date.now();
    const rank = SEVERITY_RANK[params.reason];
    const pidKey = params.pid ?? 0;
    const episode = this.getOrCreateEpisode(pidKey);

    if (params.bypassCooldown) {
      this.lastFiredAt = now;
      episode.lastFiredAtByRank[rank] = now;
      if (rank > episode.activeHighestRank) {
        episode.activeHighestRank = rank;
      }
      return {
        reason: params.reason,
        pid: params.pid,
        cpuTrend: params.cpuTrend,
        bypassCooldown: true,
      };
    }

    // Suppress duplicate reports or false downgrades within the same ongoing episode
    if (episode.activeHighestRank >= rank) {
      return null;
    }

    // Enforce cooldown for the same or higher severity rank on this PID
    const lastRankFire = Object.entries(episode.lastFiredAtByRank).reduce(
      (maxFiredAt, [firedRank, firedAt]) =>
        Number(firedRank) >= rank && firedAt > maxFiredAt
          ? firedAt
          : maxFiredAt,
      0,
    );
    if (lastRankFire > 0 && now - lastRankFire < CPU_WATCHDOG_COOLDOWN_MS) {
      return null;
    }

    const episodeEscalated = episode.activeHighestRank > 0;
    episode.activeHighestRank = rank;
    episode.recoverySamplesBelowThreshold = 0;
    episode.lastFiredAtByRank[rank] = now;
    this.lastFiredAt = now;

    return {
      reason: params.reason,
      pid: params.pid,
      cpuTrend: params.cpuTrend,
      episodeEscalated,
    };
  }
}
