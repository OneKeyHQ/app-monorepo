import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Spinner,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// This limit controls the progress dialog only, never SDK reconnects.
export const WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS = 10;

export function WalletConnectConnectionProgressView({
  progress,
}: {
  progress?: { attempt: number; relayUrl: string };
}) {
  const intl = useIntl();
  const theme = useTheme();

  return (
    <YStack
      testID="walletconnect-connection-progress"
      alignItems="center"
      gap="$6"
      pb="$1"
    >
      <YStack alignItems="center" gap="$4" width="100%">
        <YStack
          width="$16"
          height="$16"
          borderRadius="$full"
          bg="$bgInfoSubdued"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="WalletconnectBrand" size="$8" color="$iconInfo" />
        </YStack>
        <XStack alignItems="center" justifyContent="center" gap="$2.5">
          <Spinner size="small" color={theme.text.val} />
          <SizableText
            testID="walletconnect-connection-status"
            size="$headingLg"
            textAlign="center"
            flexShrink={1}
          >
            {progress
              ? `${intl.formatMessage({
                  id: ETranslations.transfer_transfer_server_status_connecting,
                })} (${Math.min(Math.max(0, progress.attempt), WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS)}/${WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS})`
              : intl.formatMessage({ id: ETranslations.global_preparing })}
          </SizableText>
        </XStack>
      </YStack>
      {progress ? (
        <YStack
          width="100%"
          alignItems="center"
          gap="$1.5"
          px="$4"
          py="$3"
          bg="$bgSubdued"
          borderRadius="$3"
          borderCurve="continuous"
        >
          <SizableText
            testID="walletconnect-connection-relay"
            size="$bodySm"
            color="$textSubdued"
            textAlign="center"
            selectable
          >
            {progress.relayUrl}
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
}
