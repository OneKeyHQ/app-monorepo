import { styled } from '../../shared/tamagui';

import { Spinner as OriginSpinner } from './Spinner';

export const Spinner = styled(OriginSpinner, {
  color: '$icon',
});

export type { ISpinnerProps } from './Spinner';
