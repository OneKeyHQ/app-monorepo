interface IPerfTimelineItem {
  title: string;
  payload?: any;

  time: string; // current time
  lag: number; // lag from previous item
  elapsed: number; // elapsed from beginning
}

export enum ETimelinePerfNames {
  createHDWallet = 'createHDWallet',
  removeWallet = 'removeWallet',
  postWalletRemoved = 'postWalletRemoved',
}

const MAX_TIMELINE_LEN = 100;

class TimelinePerfTrace {
  timelineData: Partial<Record<ETimelinePerfNames, IPerfTimelineItem[]>> = {};

  getTimelineData() {
    return this.timelineData;
  }

  clear(name: ETimelinePerfNames) {
    this.timelineData[name] = [];
  }

  mark({
    name,
    title,
    payload,
  }: {
    name: ETimelinePerfNames;
    title: string;
    payload?: any;
  }) {
    let timeline = this.timelineData[name] || [];

    const lastItem = timeline[timeline.length - 1];
    const perfNow = global.performance.now();
    const time = new Date().toLocaleString();
    timeline.push({
      lag: parseInt(String(lastItem ? perfNow - lastItem.elapsed : 0), 10),
      title,

      time,
      elapsed: Math.round(perfNow),

      payload,
    });
    timeline = timeline.slice(-1 * MAX_TIMELINE_LEN);

    this.timelineData[name] = timeline;
  }
}

export default new TimelinePerfTrace();
