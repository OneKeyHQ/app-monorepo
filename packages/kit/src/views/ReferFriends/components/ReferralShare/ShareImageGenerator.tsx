import { forwardRef, memo, useImperativeHandle } from 'react';

import type {
  IReferralShareData,
  IReferralShareImageGeneratorRef,
} from './types';

// The share card ships on phones first (the invite footer only exists on
// native). Desktop and web get a canvas renderer with their own entry point;
// until then nothing opens the dialog there, and this generator yields no
// image.
export const ShareImageGenerator = memo(
  forwardRef<IReferralShareImageGeneratorRef, { data: IReferralShareData }>(
    (_props, ref) => {
      useImperativeHandle(ref, () => ({ generate: async () => '' }));
      return null;
    },
  ),
);

ShareImageGenerator.displayName = 'ShareImageGenerator';
