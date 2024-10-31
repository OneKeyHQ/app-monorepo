class PerformanceTimer {
  private beginAt = Date.now();

  private detail: {
    [name: string]: {
      start: number | undefined;
      end: number | undefined;
      duration: number | undefined;
      params?: Record<string, any>;
    };
  } = {};

  markStart(name: string, params?: Record<string, any>) {
    this.detail[name] = {
      duration: undefined,
      start: Date.now(),
      end: undefined,
      params,
    };
  }

  markEnd(name: string) {
    if (!this.detail[name]) {
      return;
    }
    this.detail[name].end = Date.now();
    this.detail[name].duration =
      (this?.detail?.[name]?.end ?? 0) - (this?.detail?.[name]?.start ?? 0);
  }

  begin() {
    this.beginAt = Date.now();
    this.detail = {};
  }

  finish(logName?: string, minDuration?: number) {
    const finishAt = Date.now();
    const result = {
      duration: finishAt - this.beginAt,
      detail: this.detail,
      beginAt: this.beginAt,
      finishAt,
    };
    if (logName && result.duration >= (minDuration ?? -10)) {
      console.log(`PerformanceTimer:::${logName}`, result);
    }
    return result;
  }
}

function newPerf() {
  const perf = new PerformanceTimer();
  perf.begin();
  return perf;
}

export default { newPerf };
