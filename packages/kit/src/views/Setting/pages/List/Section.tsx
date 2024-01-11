import type { ComponentProps, FC, ReactNode } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';

export type ISectionProps = {
  title: string;
  titleProps?: ComponentProps<typeof SizableText>;
  children: ReactNode;
};

export const Section: FC<ISectionProps> = ({ title, titleProps, children }) => (
  <Stack>
    <SizableText
      size="$headingSm"
      paddingHorizontal="$4"
      paddingBottom="$2"
      paddingTop="$5"
      color="$textSubdued"
      {...titleProps}
    >
      {title}
    </SizableText>
    <Stack>{children}</Stack>
  </Stack>
);
