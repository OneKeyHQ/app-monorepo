import { Label as TMLabel, styled } from 'tamagui';

import type { GetProps } from 'tamagui';

const Label = styled(TMLabel, {
  fontSize: '$bodyMdMedium',
  fontWeight: '$bodyMdMedium',
});

export type LabelProps = GetProps<typeof Label>;
