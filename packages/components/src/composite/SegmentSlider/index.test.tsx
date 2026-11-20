/**
 * @jest-environment jsdom
 */

import { SegmentSlider } from '.';

import { render } from '@testing-library/react';

jest.mock('../../hooks/useStyle', () => ({
  useTheme: () => ({
    bgPrimary: { val: 'rgb(1, 1, 1)' },
    neutral5: { val: 'rgb(5, 5, 5)' },
    bg: { val: 'rgb(9, 9, 9)' },
    borderStrong: { val: 'rgb(7, 7, 7)' },
  }),
}));

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
    expect(track?.style.background).toBe('rgb(5, 5, 5)');
    expect(fill?.style.background).toBe('rgb(1, 1, 1)');
    expect(activeMarkDot?.style.background).toBe('rgb(1, 1, 1)');
    expect(thumbDot?.style.background).toBe('rgb(9, 9, 9)');
    expect(thumbDot?.style.border).toBe('1px solid rgb(7, 7, 7)');
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
    expect(track?.style.background).toBe('rgb(5, 5, 5)');
  });
});
