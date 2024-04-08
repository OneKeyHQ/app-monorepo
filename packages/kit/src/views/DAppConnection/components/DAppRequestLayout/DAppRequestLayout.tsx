import type { PropsWithChildren } from 'react';

import {
  SizableText,
  Stack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

import { DAppRiskyAlert } from './DAppRiskyAlert';
import { DAppSiteMark } from './DAppSiteMark';

function DAppRequestLayout({
  title,
  subtitle,
  origin,
  urlSecurityInfo,
  favicon,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
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
          <YStack space="$1">
            <SizableText color="$text" size="$heading3xl">
              {title}
            </SizableText>
            <SizableText color="$textSubdued" size="$bodyLg">
              {subtitle}
            </SizableText>
          </YStack>
        </Stack>
        {children}
      </Stack>
    </Stack>
  );
}

export { DAppRequestLayout };
