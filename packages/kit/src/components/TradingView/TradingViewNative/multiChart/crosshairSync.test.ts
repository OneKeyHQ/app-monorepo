import { createTradingViewNativeCrosshairSyncChannel } from './crosshairSync';

function setup(instrumentKeys = ['BTC', 'ETH', 'SOL']) {
  const channel = createTradingViewNativeCrosshairSyncChannel();
  return instrumentKeys.map((instrumentKey) => {
    const onChange = jest.fn();
    return { onChange, ...channel.join({ instrumentKey, onChange }) };
  });
}

describe('crosshair sync channel', () => {
  it('shows a shared crosshair to every other chart', () => {
    const [a, b, c] = setup();
    a.publish({ time: 100, price: 5 });

    expect(a.getPosition()).toBeNull();
    expect(a.onChange).not.toHaveBeenCalled();
    for (const chart of [b, c]) {
      expect(chart.getPosition()).toEqual({ time: 100, price: null });
      expect(chart.onChange).toHaveBeenCalledTimes(1);
    }
  });

  it('carries the price over only between charts of one instrument', () => {
    const [hourly, daily, other] = setup(['BTC', 'BTC', 'ETH']);
    hourly.publish({ time: 100, price: 5 });
    expect(daily.getPosition()).toEqual({ time: 100, price: 5 });
    expect(other.getPosition()).toEqual({ time: 100, price: null });

    // The pointer moved along one candle: only the price changed.
    hourly.publish({ time: 100, price: 6 });
    expect(daily.getPosition()).toEqual({ time: 100, price: 6 });
    expect(daily.onChange).toHaveBeenCalledTimes(2);
    expect(other.onChange).toHaveBeenCalledTimes(1);
  });

  it('stays quiet while the crosshair has not moved', () => {
    const [a, b] = setup(['BTC', 'BTC']);
    a.publish({ time: 100, price: 5 });
    a.publish({ time: 100, price: 5 });
    expect(b.onChange).toHaveBeenCalledTimes(1);
  });

  it('lets only the chart under the pointer withdraw its crosshair', () => {
    const [a, b, c] = setup();
    a.publish({ time: 100, price: null });
    b.publish(null);
    expect(c.getPosition()).toEqual({ time: 100, price: null });
    expect(c.onChange).toHaveBeenCalledTimes(1);

    a.publish(null);
    expect(c.getPosition()).toBeNull();
    expect(c.onChange).toHaveBeenCalledTimes(2);
  });

  it('hands the crosshair to the chart the pointer moved to', () => {
    const [a, b] = setup();
    a.publish({ time: 100, price: null });
    b.publish({ time: 200, price: null });
    expect(a.getPosition()).toEqual({ time: 200, price: null });
    expect(b.getPosition()).toBeNull();

    // The chart the pointer left withdraws late, after the handover.
    a.publish(null);
    expect(a.getPosition()).toEqual({ time: 200, price: null });
  });

  it('withdraws the crosshair of a chart that leaves', () => {
    const [a, b] = setup();
    a.publish({ time: 100, price: null });
    a.leave();
    expect(b.getPosition()).toBeNull();
    expect(b.onChange).toHaveBeenCalledTimes(2);

    // Neither told about the others any more, nor heard by them.
    b.publish({ time: 200, price: null });
    expect(a.onChange).not.toHaveBeenCalled();
    b.publish(null);
    a.publish({ time: 300, price: null });
    expect(b.getPosition()).toBeNull();
  });

  it('leaves no chart on a stale crosshair when one shares while told', () => {
    const [a, b, c] = setup();
    a.publish({ time: 100, price: null });
    // The pointer is already on b: it shares as soon as a withdraws.
    b.onChange.mockImplementation(() => {
      if (!b.getPosition()) b.publish({ time: 200, price: null });
    });
    const seenByC: unknown[] = [];
    c.onChange.mockImplementation(() => seenByC.push(c.getPosition()));
    a.publish(null);

    expect(seenByC.at(-1)).toEqual({ time: 200, price: null });
    expect(a.getPosition()).toEqual({ time: 200, price: null });
  });
});
