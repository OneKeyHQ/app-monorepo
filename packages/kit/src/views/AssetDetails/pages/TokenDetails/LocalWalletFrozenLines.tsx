import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  ILocalWalletFrozenPart,
  ILocalWalletFrozenReason,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Existing labels where they say it; only the password case needs its own.
const REASON_LABELS: Record<
  Exclude<ILocalWalletFrozenReason, 'needsPassword'>,
  ETranslations
> = {
  pendingSend: ETranslations.global_pending,
  confirming: ETranslations.global_confirming,
};

// What the user can act on first.
const REASON_ORDER: ILocalWalletFrozenReason[] = [
  'needsPassword',
  'pendingSend',
  'confirming',
];

// Asks for the password and confirms funds a view-only scan cannot prove
// unspent (Monero key images).
export function useLocalWalletPasswordVerify({
  networkId,
  accountId,
  onVerified,
}: {
  networkId: string;
  accountId: string;
  onVerified?: () => void;
}) {
  const [isVerifying, setIsVerifying] = useState(false);
  const verify = useCallback(async () => {
    setIsVerifying(true);
    try {
      await backgroundApiProxy.servicePrivacyChain.verifyLocalWalletWithPassword(
        { networkId, accountId },
      );
      onVerified?.();
    } catch (error) {
      console.error('[privacy-chain] password verification failed', {
        error: error instanceof Error ? error.message : '',
      });
    } finally {
      setIsVerifying(false);
    }
  }, [accountId, networkId, onVerified]);
  return { isVerifying, verify };
}

// One line per reason a privacy-chain balance is not spendable yet. Funds that
// only need the password get a Verify button that asks for it.
export function LocalWalletFrozenLines({
  networkId,
  accountId,
  frozen,
  symbol,
  maxLines,
  onVerified,
}: {
  networkId: string;
  accountId: string;
  frozen: ILocalWalletFrozenPart[] | undefined;
  symbol?: string;
  maxLines?: number;
  onVerified?: () => void;
}) {
  const intl = useIntl();
  const { isVerifying, verify } = useLocalWalletPasswordVerify({
    networkId,
    accountId,
    onVerified,
  });

  const parts = [...(frozen ?? [])]
    .toSorted(
      (a, b) => REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason),
    )
    .slice(0, maxLines);
  if (!parts.length) {
    return null;
  }
  return (
    <YStack gap="$1">
      {parts.map(({ reason, amountParsed }) => (
        <XStack key={reason} alignItems="center" gap="$2">
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            flex={1}
            numberOfLines={2}
          >
            {reason === 'needsPassword'
              ? intl.formatMessage(
                  {
                    id: ETranslations.privacy_balance_needs_verifying__msg,
                  },
                  {
                    amount: symbol ? `${amountParsed} ${symbol}` : amountParsed,
                  },
                )
              : `${intl.formatMessage({ id: REASON_LABELS[reason] })} ${
                  symbol ? `${amountParsed} ${symbol}` : amountParsed
                }`}
          </SizableText>
          {reason === 'needsPassword' ? (
            <Button
              testID="privacy-frozen-verify"
              size="small"
              variant="secondary"
              loading={isVerifying}
              onPress={verify}
            >
              {intl.formatMessage({
                id: ETranslations.privacy_balance_verify__action,
              })}
            </Button>
          ) : null}
        </XStack>
      ))}
    </YStack>
  );
}
