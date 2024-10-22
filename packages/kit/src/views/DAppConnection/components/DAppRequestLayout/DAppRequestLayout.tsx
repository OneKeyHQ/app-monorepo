import { type PropsWithChildren, useCallback } from 'react';

import type { IAlertProps } from '@onekeyhq/components';
import { SizableText, Skeleton, Stack, YStack } from '@onekeyhq/components';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

import { DAppRiskyAlert } from './DAppRiskyAlert';
import { DAppSignMessageAlert } from './DAppSignMessagAlert';
import { DAppSiteMark } from './DAppSiteMark';

function DAppRequestLayout({
  title,
  subtitle,
  subtitleShown = true,
  origin,
  urlSecurityInfo,
  favicon,
  children,
  displaySignMessageAlert,
  signMessageAlertProps,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  subtitleShown?: boolean;
  origin: string;
  urlSecurityInfo?: IHostSecurity;
  favicon?: string; // for WalletConnect
  displaySignMessageAlert?: boolean;
  signMessageAlertProps?: IAlertProps;
}>) {
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
    <Stack>
      <DAppRiskyAlert origin={origin} urlSecurityInfo={urlSecurityInfo} />
      {displaySignMessageAlert ? (
        <DAppSignMessageAlert signMessageAlertProps={signMessageAlertProps} />
      ) : null}
      <Stack p="$5" gap="$8">
        <Stack gap="$2.5">
          <DAppSiteMark
            origin={origin}
            urlSecurityInfo={urlSecurityInfo}
            favicon={favicon}
          />
          <YStack gap="$1">
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
