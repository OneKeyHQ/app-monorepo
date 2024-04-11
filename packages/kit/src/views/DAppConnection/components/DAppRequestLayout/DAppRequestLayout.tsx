import { type PropsWithChildren, useCallback } from 'react';

import {
  SizableText,
  Skeleton,
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
  subtitleShown = true,
  origin,
  urlSecurityInfo,
  favicon,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  subtitleShown?: boolean;
  origin: string;
  urlSecurityInfo?: IHostSecurity;
  favicon?: string; // for WalletConnect
}>) {
  const { top } = useSafeAreaInsets();

  const renderSubtitle = useCallback(() => {
    if (!subtitleShown) {
      return null;
    }
    if (!subtitle || !subtitle.length) {
      return (
        <Skeleton
          w={118}
          h="$6"
          $md={{
            w: '75%',
            h: '$12',
          }}
        />
      );
    }
    return (
      <SizableText color="$textSubdued" size="$bodyLg">
        {subtitle}
      </SizableText>
    );
  }, [subtitle, subtitleShown]);

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
            {renderSubtitle()}
          </YStack>
        </Stack>
        {children}
      </Stack>
    </Stack>
  );
}

export { DAppRequestLayout };
