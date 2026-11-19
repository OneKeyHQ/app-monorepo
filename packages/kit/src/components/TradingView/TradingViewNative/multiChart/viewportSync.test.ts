import { createTradingViewNativeViewportSyncChannel } from './viewportSync';

const viewport = (toTime: number) => ({
  toTime,
  rightGap: 0.1,
  fromTime: toTime - 3600,
  span: 0.8,
});

// Three panels; the first one is the main panel unless told otherwise.
function setup({ mainIndex = 0 }: { mainIndex?: number | null } = {}) {
  const channel = createTradingViewNativeViewportSyncChannel();
  const join = (isMain: boolean) => {
    const onChange = jest.fn();
    return { onChange, ...channel.join({ isMain, onChange }) };
  };
  return {
    join,
    charts: [0, 1, 2].map((index) => join(index === mainIndex)),
  };
}

describe('viewport sync channel', () => {
  it('lines the other charts up with the first panel until one is moved', () => {
    const {
      charts: [main, b, c],
    } = setup();
    // A follower reports where it is; that must not move the others.
    b.publish(viewport(90));
    expect(c.getViewport()).toBeNull();

    main.publish(viewport(100));
    expect(main.getViewport()).toBeNull();
    expect(main.onChange).not.toHaveBeenCalled();
    for (const chart of [b, c]) {
      expect(chart.getViewport()).toEqual(viewport(100));
      expect(chart.onChange).toHaveBeenCalledTimes(1);
    }
  });

  it('has nothing to follow while the first panel is not there', () => {
    const {
      charts: [a, b],
    } = setup({ mainIndex: null });
    a.publish(viewport(100));

    expect(b.getViewport()).toBeNull();
    expect(b.onChange).not.toHaveBeenCalled();
  });

  it('stays quiet while the leading chart has not moved', () => {
    const {
      charts: [main, b],
    } = setup();
    main.publish(viewport(100));
    main.publish(viewport(100));
    expect(b.onChange).toHaveBeenCalledTimes(1);
  });

  it('follows the chart the user moved last', () => {
    const {
      charts: [main, b, c],
    } = setup();
    main.publish(viewport(100));
    b.lead();
    // Not the previous chart's viewport: the new leader has yet to report.
    expect(main.getViewport()).toBeNull();
    expect(c.getViewport()).toBeNull();

    b.publish(viewport(200));
    main.publish(viewport(300));
    expect(main.getViewport()).toEqual(viewport(200));
    expect(b.getViewport()).toBeNull();
    expect(c.getViewport()).toEqual(viewport(200));
  });

  it('passes the lead to the first panel when the leading chart goes away', () => {
    const {
      join,
      charts: [main, b, c],
    } = setup();
    b.lead();
    b.publish(viewport(200));
    main.onChange.mockClear();
    c.onChange.mockClear();
    // The panel changes its interval: its chart unmounts and mounts anew.
    b.leave();

    // The first panel is asked to report what it shows, and is heard again.
    expect(main.onChange).toHaveBeenCalledTimes(1);
    expect(c.onChange).not.toHaveBeenCalled();
    expect(main.getViewport()).toBeNull();
    // The panel's next chart lines up with the others straight away.
    const remounted = join(false);
    expect(remounted.getViewport()).toEqual(viewport(200));
    main.publish(viewport(210));
    expect(remounted.getViewport()).toEqual(viewport(210));
    expect(c.getViewport()).toEqual(viewport(210));
  });

  it('passes the lead to another panel when the first one goes away', () => {
    const {
      join,
      charts: [main, b, c],
    } = setup();
    main.publish(viewport(100));
    main.leave();

    expect(b.onChange).toHaveBeenCalledTimes(2);
    expect(b.getViewport()).toBeNull();
    b.publish(viewport(110));
    expect(c.getViewport()).toEqual(viewport(110));
    // Back again, the first panel follows like any other.
    expect(join(true).getViewport()).toEqual(viewport(110));
  });

  it('forgets the viewport once every chart is gone', () => {
    const {
      join,
      charts: [main, b, c],
    } = setup();
    main.publish(viewport(100));
    for (const chart of [main, b, c]) chart.leave();
    // Stale members are neither heard nor made the leader.
    b.lead();
    b.publish(viewport(300));

    const next = join(false);
    expect(next.getViewport()).toBeNull();
  });
});
