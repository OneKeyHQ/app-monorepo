/**
 * @jest-environment jsdom
 */

import { SegmentSlider } from '.';

import { fireEvent, render } from '@testing-library/react';

jest.mock('../../hooks/useStyle', () => ({
  useTheme: () => ({
    bgPrimary: { val: '#ffffff' },
    neutral5: { val: '#555555' },
    neutral3: { val: '#eeeeee' },
    textSubdued: { val: '#777777' },
    bg: { val: '#000000' },
    borderStrong: { val: '#777777' },
    borderActive: { val: '#999999' },
  }),
}));

describe('SegmentSlider integer-aligned segment marks', () => {
  it('moves the dotted fill between integer values without duplicate callbacks', () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <SegmentSlider
        appearance="dotted"
        value={0}
        segments={4}
        onChange={onChange}
      />,
    );
    const slider = getByRole('slider');
    const track = slider.firstElementChild as HTMLDivElement;
    const fill = track.firstElementChild as HTMLDivElement;
    jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 600,
      bottom: 20,
      width: 600,
      height: 20,
      toJSON: () => ({}),
    });
    slider.setPointerCapture = jest.fn();
    slider.releasePointerCapture = jest.fn();

    fireEvent(
      slider,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 199 }),
    );
    expect(Number.parseFloat(fill.style.width)).toBeCloseTo(199 / 6);
    expect(onChange).toHaveBeenLastCalledWith(33);

    fireEvent(
      slider,
      new MouseEvent('pointermove', { bubbles: true, clientX: 200 }),
    );
    expect(Number.parseFloat(fill.style.width)).toBeCloseTo(200 / 6);
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent(slider, new MouseEvent('pointerup', { bubbles: true }));

    const quarterMark = Array.from(track.children).find(
      (child) => (child as HTMLElement).style.left === '25%',
    );
    expect(quarterMark).toBeDefined();
    fireEvent(
      quarterMark as HTMLElement,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 149 }),
    );
    expect(onChange).toHaveBeenLastCalledWith(25);

    fireEvent(
      slider,
      new MouseEvent('pointermove', { bubbles: true, clientX: 240 }),
    );
    expect(onChange).toHaveBeenLastCalledWith(40);
    fireEvent(slider, new MouseEvent('pointerup', { bubbles: true }));
  });

  it.each(['default', 'dotted'] as const)(
    'keeps integer-aligned keyboard steps with %s appearance',
    (appearance) => {
      const onChange = jest.fn();
      const { getByRole } = render(
        <SegmentSlider
          appearance={appearance}
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
    },
  );
});
