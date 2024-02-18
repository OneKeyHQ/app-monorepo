import type { PropsWithChildren } from 'react';

import { SizableText, Stack, useSafeAreaInsets } from '@onekeyhq/components';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

import { DAppRiskyAlert } from './DAppRiskyAlert';
import { DAppSiteMark } from './DAppSiteMark';

function DAppRequestLayout({
  title,
  origin,
  urlSecurityInfo,
  children,
}: PropsWithChildren<{
  title: string;
  origin: string;
  urlSecurityInfo?: IHostSecurity;
}>) {
  const { top } = useSafeAreaInsets();
  return (
    <Stack
      $md={{
        mt: top,
      }}
    >
      <DAppRiskyAlert origin={origin} urlSecurityInfo={urlSecurityInfo} />
      <Stack p="$5" space="$8">
        <Stack space="$2.5">
          <DAppSiteMark origin={origin} urlSecurityInfo={urlSecurityInfo} />
          <SizableText color="$text" size="$heading3xl">
            {title}
          </SizableText>
        </Stack>
        {children}
      </Stack>
    </Stack>
  );
}

export { DAppRequestLayout };
