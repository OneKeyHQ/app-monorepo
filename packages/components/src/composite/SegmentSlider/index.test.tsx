/**
 * @jest-environment jsdom
 */

import { useCallback, useState } from 'react';

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
      function ControlledSlider() {
        const [value, setValue] = useState(10);
        const handleChange = useCallback((next: number) => {
          onChange(next);
          setValue(next);
        }, []);
        return (
          <SegmentSlider
            appearance={appearance}
            value={value}
            min={10}
            max={100}
            segments={4}
            alignSegmentMarksToIntegerValues
            onChange={handleChange}
          />
        );
      }
      const { getByRole } = render(<ControlledSlider />);
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

function parts(container: HTMLElement) {
  const firstMark = container.querySelector<HTMLElement>(
    '[data-segment-mark="0"]',
  );
  const track = firstMark?.parentElement;
  return {
    track,
    fill: track?.firstElementChild as HTMLElement | null,
    activeMarkDot: firstMark?.firstElementChild as HTMLElement | null,
    thumbDot: container.querySelector('[data-segment-thumb]')
      ?.firstElementChild as HTMLElement | null,
  };
}

describe('SegmentSlider theme wrapper', () => {
  it('paints theme colors by default', () => {
    const { container } = render(
      <SegmentSlider value={50} segments={4} onChange={jest.fn()} />,
    );
    const { track, fill, activeMarkDot, thumbDot } = parts(container);
    expect(track?.style.background).toBe('rgb(85, 85, 85)');
    expect(fill?.style.background).toBe('rgb(255, 255, 255)');
    expect(activeMarkDot?.style.background).toBe('rgb(255, 255, 255)');
    expect(thumbDot?.style.background).toBe('rgb(0, 0, 0)');
    expect(thumbDot?.style.borderWidth).toBe('1px');
    expect(colord(thumbDot?.style.borderColor ?? '').toHex()).toBe('#777777');
  });

  it('lets callers override individual colors', () => {
    const { container } = render(
      <SegmentSlider
        value={50}
        segments={4}
        onChange={jest.fn()}
        fillColor="rgb(0, 200, 0)"
        markActiveColor="rgb(0, 150, 0)"
      />,
    );
    const { track, fill, activeMarkDot } = parts(container);
    expect(fill?.style.background).toBe('rgb(0, 200, 0)');
    expect(activeMarkDot?.style.background).toBe('rgb(0, 150, 0)');
    // Colors the caller left out keep the theme value.
    expect(track?.style.background).toBe('rgb(85, 85, 85)');
  });
});

it.each([
  [27, 25],
  [37, 37],
  [48, 50],
])('matches native tap hit zones at %s percent', (clientX, expected) => {
  const onChange = jest.fn();
  const { getByRole } = render(
    <SegmentSlider
      appearance="dotted"
      value={0}
      segments={4}
      onChange={onChange}
      snapTapToSegment
    />,
  );
  const slider = getByRole('slider');
  const track = slider.firstElementChild as HTMLDivElement;
  jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 20,
    width: 100,
    height: 20,
    toJSON: () => ({}),
  });
  slider.setPointerCapture = jest.fn();
  slider.releasePointerCapture = jest.fn();
  fireEvent(slider, new MouseEvent('pointerdown', { bubbles: true, clientX }));
  fireEvent(
    slider,
    new MouseEvent('pointermove', { bubbles: true, clientX: clientX + 1 }),
  );
  fireEvent(
    slider,
    new MouseEvent('pointerup', { bubbles: true, clientX: clientX + 1 }),
  );
  expect(onChange.mock.calls).toEqual([[expected]]);
  fireEvent(
    slider,
    new MouseEvent('pointerdown', { bubbles: true, clientX: 25 }),
  );
  fireEvent(
    slider,
    new MouseEvent('pointermove', { bubbles: true, clientX: 48 }),
  );
  fireEvent(
    slider,
    new MouseEvent('pointerup', { bubbles: true, clientX: 48 }),
  );
  expect(onChange).toHaveBeenLastCalledWith(48);
});

function renderDottedPointerSlider() {
  const onChange = jest.fn();
  const onSlideStart = jest.fn();
  const onSlideComplete = jest.fn();
  const onSlideCancel = jest.fn();
  const { getByRole, getAllByText } = render(
    <SegmentSlider
      appearance="dotted"
      value={10}
      segments={4}
      snapTapToSegment
      onChange={onChange}
      onSlideStart={onSlideStart}
      onSlideComplete={onSlideComplete}
      onSlideCancel={onSlideCancel}
    />,
  );
  const slider = getByRole('slider');
  const track = slider.firstElementChild as HTMLDivElement;
  jest.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 28,
    width: 100,
    height: 28,
    toJSON: () => ({}),
  });
  slider.setPointerCapture = jest.fn();
  slider.releasePointerCapture = jest.fn();
  const quarterMark = getAllByText('25%')[0].parentElement as HTMLElement;
  const bubble = track.lastElementChild as HTMLElement;
  return {
    slider,
    quarterMark,
    bubble,
    onChange,
    onSlideStart,
    onSlideComplete,
    onSlideCancel,
  };
}

function fireSliderPointer(
  target: HTMLElement,
  type: string,
  { pointerId = 1, pointerType = 'touch', clientX = 0, button = 0 } = {},
) {
  const event = new MouseEvent(type, { bubbles: true, clientX, button });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  fireEvent(target, event);
}

it.each([
  [33, 33],
  [27, 25],
])(
  'uses the same hit radius on the actual mark at %s percent',
  (clientX, expected) => {
    const { slider, quarterMark, onChange } = renderDottedPointerSlider();
    fireSliderPointer(quarterMark, 'pointerdown', { clientX });
    fireSliderPointer(slider, 'pointerup', { clientX });
    expect(onChange.mock.calls).toEqual([[expected]]);
  },
);

it('ignores a right-button press on the dotted slider', () => {
  const { slider, onChange, onSlideStart } = renderDottedPointerSlider();
  fireSliderPointer(slider, 'pointerdown', {
    pointerType: 'mouse',
    clientX: 33,
    button: 2,
  });
  expect(onChange).not.toHaveBeenCalled();
  expect(onSlideStart).not.toHaveBeenCalled();
});

it.each(['pointercancel', 'lostpointercapture'])(
  'preserves ownership and restores the original value on owner %s',
  (cancelEvent) => {
    const {
      slider,
      quarterMark,
      bubble,
      onChange,
      onSlideStart,
      onSlideComplete,
      onSlideCancel,
    } = renderDottedPointerSlider();
    fireSliderPointer(slider, 'pointerdown', { clientX: 33 });
    fireSliderPointer(slider, 'pointermove', { clientX: 48 });
    fireSliderPointer(quarterMark, 'pointerdown', {
      pointerId: 2,
      clientX: 27,
    });
    fireSliderPointer(slider, 'pointermove', { pointerId: 2, clientX: 90 });
    fireSliderPointer(slider, 'pointerup', { pointerId: 2, clientX: 90 });
    fireSliderPointer(slider, cancelEvent, { pointerId: 2 });
    expect(onChange.mock.calls).toEqual([[33], [48]]);
    expect(onSlideStart).toHaveBeenCalledTimes(1);
    expect(onSlideCancel).not.toHaveBeenCalled();
    expect(onSlideComplete).not.toHaveBeenCalled();
    expect(bubble.textContent).toBe('48%');

    fireSliderPointer(slider, cancelEvent);
    expect(onSlideCancel).toHaveBeenCalledTimes(1);
    expect(onSlideComplete).toHaveBeenCalledTimes(1);
    expect(bubble.textContent).toBe('10%');

    fireSliderPointer(slider, 'pointerdown', { pointerId: 2, clientX: 90 });
    fireSliderPointer(slider, 'pointerup', { pointerId: 2, clientX: 90 });
    expect(onChange).toHaveBeenLastCalledWith(90);
    expect(onSlideStart).toHaveBeenCalledTimes(2);
    expect(onSlideComplete).toHaveBeenCalledTimes(2);
  },
);
