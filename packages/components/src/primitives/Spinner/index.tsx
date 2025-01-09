import { Spinner as OriginSpinner, styled } from 'tamagui';

import type { GetProps } from 'tamagui';

export const Spinner = styled(OriginSpinner, {
  color: '$icon',
});

export type ISpinnerProps = GetProps<typeof Spinner>;
