import { getAnchoredFrame, resolveAnchoredOffset } from './anchoredFrame';

const window = { width: 951, height: 669 };
const insets = { top: 0, left: 0, bottom: 20, right: 84 };
// Viewport after padding: x 8..859, y 8..641.
const trigger = { x: 427, y: 188, width: 50, height: 50 };

function frameFor(
  overrides: Partial<Parameters<typeof getAnchoredFrame>[0]> = {},
) {
  return getAnchoredFrame({
    anchor: trigger,
    placement: 'bottom-end',
    offset: 8,
    crossOffset: 0,
    width: 240,
    window,
    insets,
    ...overrides,
  });
}

describe('getAnchoredFrame', () => {
  it('aligns a fixed-width panel to the trigger edge below it', () => {
    const frame = frameFor();
    expect(frame.left + frame.width).toBe(trigger.x + trigger.width);
    expect(frame.panelWidth).toBe(240);
    expect(frame.top).toBe(trigger.y + trigger.height + 8);
    expect(frame.justifyContent).toBe('flex-start');
  });

  it('applies the cross-axis offset before clamping', () => {
    expect(frameFor({ crossOffset: -20 }).left).toBe(
      trigger.x + trigger.width - 240 - 20,
    );
    expect(frameFor({ crossOffset: 1000 }).left).toBe(859 - 240);
  });

  it('sizes an auto-width panel to content against the aligned edge', () => {
    const end = frameFor({ width: undefined });
    expect(end.panelWidth).toBeUndefined();
    expect(end.alignItems).toBe('flex-end');
    expect(end.left + end.width).toBe(trigger.x + trigger.width);

    const start = frameFor({ width: undefined, placement: 'bottom-start' });
    expect(start.alignItems).toBe('flex-start');
    expect(start.left).toBe(trigger.x);

    const center = frameFor({ width: undefined, placement: 'bottom' });
    expect(center.alignItems).toBe('center');
    expect(center.left + center.width / 2).toBe(trigger.x + trigger.width / 2);
  });

  it('opens above when there is not enough room below', () => {
    const frame = frameFor({ anchor: { ...trigger, y: 560 } });
    expect(frame.justifyContent).toBe('flex-end');
    expect(frame.top + frame.height).toBe(560 - 8);
  });

  it('places right placements beside the trigger', () => {
    const frame = frameFor({ placement: 'right-start' });
    expect(frame.left).toBe(trigger.x + trigger.width + 8);
    expect(frame.alignItems).toBe('flex-start');
    expect(frame.top).toBe(trigger.y);
    expect(frame.justifyContent).toBe('flex-start');
    expect(frame.panelWidth).toBe(240);
  });

  it.each(['right-start', 'left-start'] as const)(
    'keeps %s menus usable near the bottom edge',
    (placement) => {
      const frame = frameFor({ placement, anchor: { ...trigger, y: 620 } });
      expect(frame.height).toBeGreaterThanOrEqual(240);
      expect(frame.top).toBeGreaterThanOrEqual(8);
      expect(frame.top + frame.height).toBeLessThanOrEqual(641);
      expect(frame.justifyContent).toBe('flex-end');
    },
  );

  it('keeps centered side menus usable near an edge', () => {
    const frame = frameFor({
      placement: 'right',
      anchor: { ...trigger, y: 630 },
    });
    expect(frame.height).toBeGreaterThanOrEqual(240);
    expect(frame.top + frame.height).toBeLessThanOrEqual(641);
  });

  it('flips a side placement when that side is too narrow', () => {
    const frame = frameFor({
      placement: 'right',
      anchor: { ...trigger, x: 700 },
    });
    expect(frame.alignItems).toBe('flex-end');
    expect(frame.left + frame.width).toBe(700 - 8);
    expect(frame.justifyContent).toBe('center');
    expect(frame.top + frame.height / 2).toBe(trigger.y + trigger.height / 2);
  });

  it('keeps a side placement whose side is the only one with room', () => {
    const frame = frameFor({
      placement: 'left-end',
      anchor: { ...trigger, x: 100, y: 300 },
    });
    expect(frame.alignItems).toBe('flex-start');
    expect(frame.justifyContent).toBe('flex-end');
    expect(frame.top + frame.height).toBe(300 + trigger.height);
  });
});

describe('resolveAnchoredOffset', () => {
  it('reads floating-ui offset options', () => {
    expect(resolveAnchoredOffset(4, 'bottom')).toEqual({
      mainAxis: 4,
      crossAxis: 0,
    });
    expect(resolveAnchoredOffset(undefined, 'bottom')).toEqual({
      mainAxis: 8,
      crossAxis: 0,
    });
    expect(
      resolveAnchoredOffset({ mainAxis: -4, crossAxis: -10 }, 'bottom-end'),
    ).toEqual({ mainAxis: -4, crossAxis: -10 });
    expect(resolveAnchoredOffset({ alignmentAxis: 6 }, 'bottom-end')).toEqual({
      mainAxis: 0,
      crossAxis: -6,
    });
  });
});
