import type { PropsWithChildren } from 'react';

import { withStaticProperties } from 'tamagui';

import { Stack } from '../Stack';

import { PageFooter } from './PageFooter';
import { PageHeader } from './PageHeader';

function BasicPage({ children }: PropsWithChildren<unknown>) {
  return (
    <Stack bg="$bg" flex={1}>
      {children}
    </Stack>
  );
}

export const Page = withStaticProperties(BasicPage, {
  Header: PageHeader,
  Footer: PageFooter,
});
