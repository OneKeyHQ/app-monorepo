/**
 * @jest-environment jsdom
 */

import { SegmentSlider } from '.';

import { fireEvent, render } from '@testing-library/react';

jest.mock('../../hooks/useStyle', () => ({
  useTheme: () => ({
    bgPrimary: { val: '#ffffff' },
    neutral5: { val: '#555555' },
    bg: { val: '#000000' },
    borderStrong: { val: '#777777' },
    borderActive: { val: '#999999' },
  }),
}));

describe('SegmentSlider integer-aligned segment marks', () => {
  it('moves through the same integer values used by the brightness marks', () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <SegmentSlider
        value={10}
        min={10}
        max={100}
        segments={4}
        alignSegmentMarksToIntegerValues
        onChange={onChange}
      />,
    );
    const slider = getByRole('slider');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenNthCalledWith(1, 32);
    expect(onChange).toHaveBeenNthCalledWith(2, 55);
    expect(onChange).toHaveBeenNthCalledWith(3, 78);
    expect(onChange).toHaveBeenNthCalledWith(4, 100);
  });
});

// jsdom has no PointerEvent, so fireEvent.pointer* would drop clientX.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  globalThis.PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent;
}

describe('SegmentSlider tap snapping', () => {
  const TRACK_WIDTH = 100;
  let rectSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    rectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        left: 0,
        top: 0,
        right: TRACK_WIDTH,
        bottom: 4,
        width: TRACK_WIDTH,
        height: 4,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    HTMLElement.prototype.setPointerCapture = jest.fn();
    HTMLElement.prototype.releasePointerCapture = jest.fn();
  });

  afterEach(() => {
    rectSpy.mockRestore();
    jest.useRealTimers();
  });

  function renderSlider(snapTapToSegment?: boolean) {
    const onChange = jest.fn();
    const utils = render(
      <SegmentSlider
        value={0}
        segments={4}
        snapTapToSegment={snapTapToSegment}
        onChange={onChange}
      />,
    );
    return { onChange, slider: utils.getByRole('slider') };
  }

  it('snaps a tap to the nearest segment mark by default', () => {
    const { onChange, slider } = renderSlider();

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 68 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 68 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(75);
  });

  it('keeps a drag free while tap snapping is on', () => {
    const { onChange, slider } = renderSlider();

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 10 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 68 });
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 68 });

    expect(onChange).toHaveBeenLastCalledWith(68);
  });

  it('lands a tap on the pressed position when tap snapping is off', () => {
    const { onChange, slider } = renderSlider(false);

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 68 });
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 68 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(68);
  });
});
