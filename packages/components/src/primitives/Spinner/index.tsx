import { styled } from '@tamagui/web';

import { Spinner as OriginSpinner } from './Spinner';

export const Spinner = styled(OriginSpinner, {
  color: '$icon',
});

export type { ISpinnerProps } from './Spinner';
