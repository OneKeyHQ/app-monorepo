import type { ComponentProps, FC, ReactNode } from 'react';

import { Stack, Text } from '@onekeyhq/components';

export type ISectionProps = {
  title: string;
  titleProps?: ComponentProps<typeof Text>;
  children: ReactNode;
};

export const Section: FC<ISectionProps> = ({ title, titleProps, children }) => (
  <Stack>
    <Text
      variant="$headingSm"
      paddingHorizontal="$4"
      paddingBottom="$2"
      paddingTop="$5"
      color="$textSubdued"
      {...titleProps}
    >
      {title}
    </Text>
    <Stack>{children}</Stack>
  </Stack>
);
