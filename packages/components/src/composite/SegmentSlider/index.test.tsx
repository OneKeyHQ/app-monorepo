/**
 * @jest-environment jsdom
 */

import { fireEvent, render } from '@testing-library/react';

import { SegmentSlider } from '.';

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
