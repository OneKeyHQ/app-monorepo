import type { PropsWithChildren } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';

import { DAppRiskyAlert, DAppSiteMark } from '../DAppRequestHeader';

function DAppRequestLayout({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <Stack>
      <DAppRiskyAlert />
      <Stack p="$5" space="$8">
        <Stack space="$2.5">
          <DAppSiteMark riskyLevel="Verified" />
          <SizableText color="$text" size="$heading3xl">
            {title}
          </SizableText>
        </Stack>
        {children}
      </Stack>
    </Stack>
  );
}

export default DAppRequestLayout;
