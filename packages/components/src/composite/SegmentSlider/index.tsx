import { memo } from 'react';

import { DefaultSegmentSlider } from './DefaultSegmentSlider';
import { DottedSlider } from './DottedSlider';

import type { ISegmentSliderProps } from './DefaultSegmentSlider';

export type { ISegmentSliderProps } from './DefaultSegmentSlider';

function PlatformSegmentSlider(props: ISegmentSliderProps) {
  return props.appearance === 'dotted' ? (
    <DottedSlider {...props} />
  ) : (
    <DefaultSegmentSlider {...props} />
  );
}

export const SegmentSlider = memo(PlatformSegmentSlider);
SegmentSlider.displayName = 'SegmentSlider';
