import type { FC, ReactNode } from 'react';

import { Stack, Text } from '@onekeyhq/components';

export type ISectionProps = {
  title: string;
  children: ReactNode;
};

export const Section: FC<ISectionProps> = ({ title, children }) => (
  <Stack>
    <Text
      variant="$headingSm"
      paddingHorizontal="$4"
      paddingBottom="$2"
      paddingTop="$5"
      color="$textSubdued"
    >
      {title}
    </Text>
    <Stack>{children}</Stack>
  </Stack>
);
