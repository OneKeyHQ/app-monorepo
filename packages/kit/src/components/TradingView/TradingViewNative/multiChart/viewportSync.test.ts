import { createTradingViewNativeViewportSyncChannel } from './viewportSync';

const viewport = (toTime: number) => ({
  toTime,
  rightGap: 0.1,
  fromTime: toTime - 3600,
  span: 0.8,
});

function setup() {
  const channel = createTradingViewNativeViewportSyncChannel();
  const charts = [0, 1, 2].map(() => {
    const onChange = jest.fn();
    return { onChange, ...channel.join({ onChange }) };
  });
  return { channel, charts };
}

describe('viewport sync channel', () => {
  it('has nothing to follow until a chart leads', () => {
    const {
      channel,
      charts: [a, b],
    } = setup();
    a.publish(viewport(100));

    expect(channel.hasLeader()).toBe(false);
    expect(b.getViewport()).toBeNull();
    expect(b.onChange).not.toHaveBeenCalled();
  });

  it('lines the other charts up with the leading one', () => {
    const {
      channel,
      charts: [a, b, c],
    } = setup();
    a.lead();
    a.publish(viewport(100));

    expect(channel.hasLeader()).toBe(true);
    expect(a.getViewport()).toBeNull();
    expect(a.onChange).not.toHaveBeenCalled();
    for (const chart of [b, c]) {
      expect(chart.getViewport()).toEqual(viewport(100));
      expect(chart.onChange).toHaveBeenCalledTimes(1);
    }
  });

  it('ignores the charts that only follow', () => {
    const {
      charts: [a, b, c],
    } = setup();
    a.lead();
    a.publish(viewport(100));
    // A follower reports where it ended up; that must not move the others.
    b.publish(viewport(90));

    expect(c.getViewport()).toEqual(viewport(100));
    expect(c.onChange).toHaveBeenCalledTimes(1);
    expect(a.onChange).not.toHaveBeenCalled();
  });

  it('stays quiet while the leading chart has not moved', () => {
    const {
      charts: [a, b],
    } = setup();
    a.lead();
    a.publish(viewport(100));
    a.publish(viewport(100));
    expect(b.onChange).toHaveBeenCalledTimes(1);
  });

  it('follows the chart the user moved last', () => {
    const {
      charts: [a, b, c],
    } = setup();
    a.lead();
    a.publish(viewport(100));
    b.lead();
    // Not the previous chart's viewport: the new leader has yet to report.
    expect(a.getViewport()).toBeNull();
    expect(c.getViewport()).toBeNull();

    b.publish(viewport(200));
    a.publish(viewport(300));
    expect(a.getViewport()).toEqual(viewport(200));
    expect(b.getViewport()).toBeNull();
    expect(c.getViewport()).toEqual(viewport(200));
  });

  it('leaves the others where they are when the leading chart goes away', () => {
    const {
      channel,
      charts: [a, b],
    } = setup();
    a.lead();
    a.publish(viewport(100));
    a.leave();

    expect(channel.hasLeader()).toBe(false);
    expect(b.getViewport()).toBeNull();
    expect(b.onChange).toHaveBeenCalledTimes(1);
    a.lead();
    expect(channel.hasLeader()).toBe(false);
  });
});
