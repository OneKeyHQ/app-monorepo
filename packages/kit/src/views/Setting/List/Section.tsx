import type { FC, ReactNode } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';

export type ISectionProps = {
  title: string;
  children: ReactNode;
};

export const Section: FC<ISectionProps> = ({ title, children }) => (
  <Stack>
    <SizableText
      size="$headingSm"
      paddingHorizontal="$4"
      paddingBottom="$2"
      paddingTop="$5"
      color="$textSubdued"
    >
      {title}
    </SizableText>
    <Stack>{children}</Stack>
  </Stack>
);
