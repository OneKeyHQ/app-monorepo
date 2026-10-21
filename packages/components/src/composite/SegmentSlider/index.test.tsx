/**
 * @jest-environment jsdom
 */

import { SegmentSlider } from '.';

import { fireEvent, render } from '@testing-library/react';
import { colord } from 'colord';

import { resolveDottedSliderColor } from './dottedSliderUtils';

jest.mock('../../hooks/useStyle', () => ({
  useTheme: () => ({
    bgPrimary: { val: '#ffffff' },
    neutral5: { val: '#555555' },
    neutral3: { val: '#eeeeee' },
    bgApp: { val: '#000000' },
    textSubdued: { val: '#777777' },
    bg: { val: '#000000' },
    text: { val: '#ffffff' },
    bgSubdued: { val: '#222222' },
    borderSubdued: { val: '#333333' },
    borderStrong: { val: '#777777' },
    borderActive: { val: '#999999' },
  }),
}));

describe('SegmentSlider integer-aligned segment marks', () => {
  it('flattens translucent theme colors so the fill and both sides of the thumb match', () => {
    expect(
      resolveDottedSliderColor(
        'rgba(0, 255, 0, 0.5)',
        'rgba(255, 255, 255, 0.5)',
        '#000000',
      ),
    ).toBe('#40bf40');
    const { getByRole } = render(
      <SegmentSlider
        appearance="dotted"
        activeColor="#00ff0080"
        value={50}
        segments={4}
        onChange={jest.fn()}
      />,
    );
    const track = getByRole('slider').firstElementChild as HTMLElement;
    const fill = track.querySelector(
      '[data-testid="segment-slider-fill"]',
    ) as HTMLElement;
    const thumb = track.lastElementChild?.previousElementSibling
      ?.firstElementChild as HTMLElement;
    expect(fill.style.backgroundColor).toBe('rgb(119, 247, 119)');
    expect(colord(thumb.style.borderColor).toHex()).toBe(
      colord(fill.style.backgroundColor).toHex(),
    );
  });

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
    const fill = track.querySelector(
      '[data-testid="segment-slider-fill"]',
    ) as HTMLDivElement;
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
    expect(
      Number.parseFloat(fill.style.width.replace('calc(', '')),
    ).toBeCloseTo(199 / 6);
    expect(onChange).toHaveBeenLastCalledWith(33);

    fireEvent(
      slider,
      new MouseEvent('pointermove', { bubbles: true, clientX: 200 }),
    );
    expect(
      Number.parseFloat(fill.style.width.replace('calc(', '')),
    ).toBeCloseTo(200 / 6);
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

  it('shows in-track labels while dragging and updates the current-value bubble at both ends', () => {
    const { getByRole, getAllByText } = render(
      <SegmentSlider
        appearance="dotted"
        activeColor="#2bdc16"
        value={0}
        segments={4}
        onChange={jest.fn()}
      />,
    );
    const slider = getByRole('slider');
    const track = slider.firstElementChild as HTMLDivElement;
    jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 14,
      y: 8,
      left: 14,
      top: 8,
      right: 314,
      bottom: 36,
      width: 300,
      height: 28,
      toJSON: () => ({}),
    });
    slider.setPointerCapture = jest.fn();
    slider.releasePointerCapture = jest.fn();
    const label = getAllByText('25%')[0];
    expect(label.style.opacity).toBe('0');
    fireEvent(
      slider,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 164 }),
    );
    expect(label.style.opacity).toBe('0.65');
    const bubble = track.lastElementChild as HTMLDivElement;
    expect(bubble.textContent).toBe('50%');
    expect(bubble.style.opacity).toBe('1');
    fireEvent(
      slider,
      new MouseEvent('pointermove', { bubbles: true, clientX: 999 }),
    );
    expect(bubble.textContent).toBe('100%');
    fireEvent(
      slider,
      new MouseEvent('pointermove', { bubbles: true, clientX: -100 }),
    );
    expect(bubble.textContent).toBe('0%');
    fireEvent(slider, new MouseEvent('pointercancel', { bubbles: true }));
    expect(label.style.opacity).toBe('0');
    expect(bubble.style.opacity).toBe('0');
  });

  it('shows the attached bubble and grows on mouse hover, retaining both until an active press ends', () => {
    const onChange = jest.fn();
    const { getByRole, getAllByText } = render(
      <SegmentSlider
        appearance="dotted"
        value={50}
        segments={4}
        onChange={onChange}
      />,
    );
    const slider = getByRole('slider');
    const label = getAllByText('25%')[0];
    const bubble = slider.firstElementChild?.lastElementChild as HTMLElement;
    const enter = new MouseEvent('pointerover', { bubbles: true });
    Object.defineProperty(enter, 'pointerType', { value: 'mouse' });
    fireEvent(slider, enter);
    expect(label.style.opacity).toBe('0.65');
    expect(bubble.style.opacity).toBe('1');
    expect(slider.style.transform).toBe('scale(1.04)');
    expect(onChange).not.toHaveBeenCalled();
    slider.setPointerCapture = jest.fn();
    slider.releasePointerCapture = jest.fn();
    fireEvent(slider, new MouseEvent('pointerdown', { bubbles: true }));
    fireEvent(slider, new MouseEvent('pointerout', { bubbles: true }));
    expect(bubble.style.opacity).toBe('1');
    expect(slider.style.transform).toBe('scale(1.04)');
    fireEvent(slider, new MouseEvent('pointercancel', { bubbles: true }));
    expect(bubble.style.opacity).toBe('0');
    expect(label.style.opacity).toBe('0');
    expect(slider.style.transform).toBe('scale(1)');
  });

  it.each([
    { pointerType: 'touch', disabled: false },
    { pointerType: 'mouse', disabled: true },
  ])(
    'does not activate hover for $pointerType when disabled=$disabled',
    ({ pointerType, disabled }) => {
      const { getByRole, getAllByText } = render(
        <SegmentSlider
          appearance="dotted"
          value={50}
          segments={4}
          disabled={disabled}
          onChange={jest.fn()}
        />,
      );
      const slider = getByRole('slider');
      const enter = new MouseEvent('pointerover', { bubbles: true });
      Object.defineProperty(enter, 'pointerType', { value: pointerType });
      fireEvent(slider, enter);
      expect(getAllByText('25%')[0].style.opacity).toBe('0');
      expect(slider.style.transform).toBe('scale(1)');
    },
  );

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
