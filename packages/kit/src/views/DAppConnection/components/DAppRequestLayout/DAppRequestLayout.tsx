import type { PropsWithChildren } from 'react';

import { SizableText, Stack, useSafeAreaInsets } from '@onekeyhq/components';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

import { DAppRiskyAlert } from './DAppRiskyAlert';
import { DAppSiteMark } from './DAppSiteMark';

function DAppRequestLayout({
  title,
  origin,
  urlSecurityInfo,
  favicon,
  children,
}: PropsWithChildren<{
  title: string;
  origin: string;
  urlSecurityInfo?: IHostSecurity;
  favicon?: string; // for WalletConnect
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
          <DAppSiteMark
            origin={origin}
            urlSecurityInfo={urlSecurityInfo}
            favicon={favicon}
          />
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
