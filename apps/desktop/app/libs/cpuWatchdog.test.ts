import {
  CPU_WATCHDOG_COOLDOWN_MS,
  CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES,
  CPU_WATCHDOG_RECOVERY_SUSTAINED_SAMPLES,
  CPU_WATCHDOG_SAMPLE_INTERVAL_MS,
  CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
  CPU_WATCHDOG_STARTUP_GRACE_MS,
  CpuWatchdogController,
} from './cpuWatchdog';

describe('CpuWatchdogController', () => {
  function feedSamples(
    controller: CpuWatchdogController,
    params: {
      pid: number;
      effectivePct: number;
      count: number;
      startTime: number;
      startCum: number;
      ignoredTabPids?: ReadonlySet<number>;
    },
  ) {
    let now = params.startTime;
    let cum = params.startCum;
    const fired = [];
    for (let i = 0; i < params.count; i += 1) {
      now += CPU_WATCHDOG_SAMPLE_INTERVAL_MS;
      cum +=
        (params.effectivePct / 100) * (CPU_WATCHDOG_SAMPLE_INTERVAL_MS / 1000);
      const res = controller.sampleMetrics({
        now,
        ignoredTabPids: params.ignoredTabPids,
        metrics: [
          {
            pid: params.pid,
            type: 'Tab',
            percentCPUUsage: params.effectivePct / 8,
            cumulativeCPUUsage: cum,
          },
        ],
      });
      fired.push(...res.eventsToFire);
    }
    return { now, cum, fired };
  }

  it('ignores cold-start CPU spikes during the startup grace window', () => {
    const controller = new CpuWatchdogController();
    const startTime = 1_000_000;
    controller.start(startTime);

    // Baseline sample at t=0
    controller.sampleMetrics({
      now: startTime,
      metrics: [
        { pid: 101, type: 'Tab', percentCPUUsage: 0, cumulativeCPUUsage: 0 },
      ],
    });

    // 6 samples at 120% during the 60s startup grace period
    const duringGrace = feedSamples(controller, {
      pid: 101,
      effectivePct: 120,
      count: CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
      startTime,
      startCum: 0,
    });
    expect(duringGrace.fired).toHaveLength(0);

    // Sustained 120% after startup grace triggers severe once
    const afterGrace = feedSamples(controller, {
      pid: 101,
      effectivePct: 120,
      count: CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
      startTime: duringGrace.now,
      startCum: duringGrace.cum,
    });
    expect(afterGrace.fired).toHaveLength(1);
    expect(afterGrace.fired[0]).toMatchObject({
      reason: 'sustained-high-cpu-severe',
      pid: 101,
    });
  });

  it('deduplicates a continuous multi-hour severe episode and prevents false downgrade to mild', () => {
    const controller = new CpuWatchdogController();
    const startTime = 1_000_000;
    controller.start(startTime);

    const t0 = startTime + CPU_WATCHDOG_STARTUP_GRACE_MS;
    controller.sampleMetrics({
      now: t0,
      metrics: [
        { pid: 202, type: 'Tab', percentCPUUsage: 0, cumulativeCPUUsage: 0 },
      ],
    });

    // Run 2 hours (720 samples of 10s) at 110% CPU
    const twoHours = feedSamples(controller, {
      pid: 202,
      effectivePct: 110,
      count: 720,
      startTime: t0,
      startCum: 0,
    });
    expect(twoHours.fired).toHaveLength(1);
    expect(twoHours.fired[0].reason).toBe('sustained-high-cpu-severe');

    // Dip one sample to 88% (below 95% severe, above 80% mild) after >30m cooldown:
    // must NOT false-downgrade and fire sustained-high-cpu-mild
    const dip = feedSamples(controller, {
      pid: 202,
      effectivePct: 88,
      count: 1,
      startTime: twoHours.now,
      startCum: twoHours.cum,
    });
    expect(dip.fired).toHaveLength(0);
  });

  it('allows severity escalation from mild to severe and unresponsive within the same episode', () => {
    const controller = new CpuWatchdogController();
    const startTime = 1_000_000;
    controller.start(startTime);

    const t0 = startTime + CPU_WATCHDOG_STARTUP_GRACE_MS;
    controller.sampleMetrics({
      now: t0,
      metrics: [
        { pid: 303, type: 'Tab', percentCPUUsage: 0, cumulativeCPUUsage: 0 },
      ],
    });

    // 30 samples at 85% -> fires mild
    const mildPhase = feedSamples(controller, {
      pid: 303,
      effectivePct: 85,
      count: CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES,
      startTime: t0,
      startCum: 0,
    });
    expect(mildPhase.fired).toHaveLength(1);
    expect(mildPhase.fired[0]).toMatchObject({
      reason: 'sustained-high-cpu-mild',
      pid: 303,
      episodeEscalated: false,
    });

    // Escalate to 115% for 6 samples within the 30m window -> fires severe once
    const severePhase = feedSamples(controller, {
      pid: 303,
      effectivePct: 115,
      count: CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
      startTime: mildPhase.now,
      startCum: mildPhase.cum,
    });
    expect(severePhase.fired).toHaveLength(1);
    expect(severePhase.fired[0]).toMatchObject({
      reason: 'sustained-high-cpu-severe',
      pid: 303,
      episodeEscalated: true,
    });

    // Escalate to unresponsive on the same PID -> fires unresponsive once
    const unresponsive = controller.evaluateTrigger({
      reason: 'unresponsive',
      pid: 303,
      now: severePhase.now + 1000,
    });
    expect(unresponsive).toMatchObject({
      reason: 'unresponsive',
      pid: 303,
      episodeEscalated: true,
    });
  });

  it('re-arms after sustained recovery below threshold and cooldown expiry', () => {
    const controller = new CpuWatchdogController();
    const startTime = 1_000_000;
    controller.start(startTime);

    const t0 = startTime + CPU_WATCHDOG_STARTUP_GRACE_MS;
    controller.sampleMetrics({
      now: t0,
      metrics: [
        { pid: 404, type: 'Tab', percentCPUUsage: 0, cumulativeCPUUsage: 0 },
      ],
    });

    const firstEpisode = feedSamples(controller, {
      pid: 404,
      effectivePct: 120,
      count: CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
      startTime: t0,
      startCum: 0,
    });
    expect(firstEpisode.fired).toHaveLength(1);

    // Recover below 50% for 6 samples (60s)
    const recovery = feedSamples(controller, {
      pid: 404,
      effectivePct: 10,
      count: CPU_WATCHDOG_RECOVERY_SUSTAINED_SAMPLES,
      startTime: firstEpisode.now,
      startCum: firstEpisode.cum,
    });
    expect(recovery.fired).toHaveLength(0);

    // Re-spike before 30m cooldown expires -> suppressed by cooldown
    const duringCooldown = feedSamples(controller, {
      pid: 404,
      effectivePct: 120,
      count: CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
      startTime: recovery.now,
      startCum: recovery.cum,
    });
    expect(duringCooldown.fired).toHaveLength(0);

    // Lower-severity mild sustained spike during the severe 30m cooldown is also suppressed
    const mildDuringCooldown = feedSamples(controller, {
      pid: 404,
      effectivePct: 85,
      count: CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES,
      startTime: duringCooldown.now,
      startCum: duringCooldown.cum,
    });
    expect(mildDuringCooldown.fired).toHaveLength(0);

    // Recover again and advance past 30m cooldown
    const secondRecovery = feedSamples(controller, {
      pid: 404,
      effectivePct: 5,
      count: CPU_WATCHDOG_RECOVERY_SUSTAINED_SAMPLES,
      startTime: firstEpisode.now + CPU_WATCHDOG_COOLDOWN_MS,
      startCum: mildDuringCooldown.cum,
    });
    const afterCooldown = feedSamples(controller, {
      pid: 404,
      effectivePct: 120,
      count: CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
      startTime: secondRecovery.now,
      startCum: secondRecovery.cum,
    });
    expect(afterCooldown.fired).toHaveLength(1);
    expect(afterCooldown.fired[0].reason).toBe('sustained-high-cpu-severe');
  });

  it('ignores external guest webview Tab PIDs when specified in ignoredTabPids', () => {
    const controller = new CpuWatchdogController();
    const startTime = 1_000_000;
    controller.start(startTime);

    const t0 = startTime + CPU_WATCHDOG_STARTUP_GRACE_MS;
    controller.sampleMetrics({
      now: t0,
      ignoredTabPids: new Set([999]),
      metrics: [
        { pid: 999, type: 'Tab', percentCPUUsage: 0, cumulativeCPUUsage: 0 },
      ],
    });

    const guestSpike = feedSamples(controller, {
      pid: 999,
      effectivePct: 150,
      count: CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES + 2,
      startTime: t0,
      startCum: 0,
      ignoredTabPids: new Set([999]),
    });
    expect(guestSpike.fired).toHaveLength(0);
  });
});
