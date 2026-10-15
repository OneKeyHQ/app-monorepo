import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useLocalWalletPasswordVerify } from './LocalWalletFrozenLines';

// One line wherever the balance is read when part of it waits for the
// password: without it the spendable figure looks wrong for no visible reason.
// The why is in the balance details.
export function LocalWalletPasswordAlert({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const intl = useIntl();
  const { result, run } = usePromiseResult(async () => {
    const [balance, network] = await Promise.all([
      backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountBalance({
        networkId,
        accountId,
      }),
      backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    ]);
    const part = balance?.frozen?.find(
      ({ reason }) => reason === 'needsPassword',
    );
    return part ? `${part.amountParsed} ${network.symbol}` : undefined;
  }, [accountId, networkId]);
  useEffect(() => {
    const refresh = () => {
      void run();
    };
    appEventBus.on(EAppEventBusNames.RefreshTokenList, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshTokenList, refresh);
    };
  }, [run]);
  const { isVerifying, verify } = useLocalWalletPasswordVerify({
    networkId,
    accountId,
    onVerified: () => {
      void run();
    },
  });

  if (!result) {
    return null;
  }
  return (
    <XStack alignItems="center" gap="$2">
      <Icon name="LockOutline" size="$4" color="$iconCaution" />
      <SizableText size="$bodySm" color="$textCaution" flexShrink={1}>
        {intl.formatMessage(
          {
            id: ETranslations.privacy_balance_needs_verifying__msg,
          },
          { amount: result },
        )}
      </SizableText>
      <Button
        testID="privacy-password-verify"
        size="small"
        variant="tertiary"
        loading={isVerifying}
        onPress={() => {
          void verify();
        }}
      >
        {intl.formatMessage({
          id: ETranslations.privacy_balance_verify__action,
        })}
      </Button>
    </XStack>
  );
}
