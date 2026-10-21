import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  isStrk20Mismatch,
  isStrk20RegisterPending,
  isStrk20Registered,
  isStrk20SequencingWaiting,
  useStarknetPrivacyAccountState,
  useStarknetPrivacyAvailability,
  useStarknetPrivacySequencing,
  useStarknetPrivateBalances,
} from '@onekeyhq/kit/src/views/StarknetPrivacy/hooks/useStarknetPrivacy';
import { useStarknetPrivacyOptIn } from '@onekeyhq/kit/src/views/StarknetPrivacy/hooks/useStarknetPrivacyOptIn';
import {
  formatMockMessage,
  formatStrk20Countdown,
} from '@onekeyhq/kit/src/views/StarknetPrivacy/utils/starknetPrivacyUtils';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import { EStrk20ErrorRetry } from '@onekeyhq/shared/types/starknetPrivacy';
import type { IStrk20TransferKind } from '@onekeyhq/shared/types/starknetPrivacy';
import type { IToken } from '@onekeyhq/shared/types/token';

type IProps = {
  networkId: string;
  accountId: string;
  token: IToken;
  /** Public balance already fetched by the header, in token units. */
  publicBalanceParsed?: string;
};

function AmountRow({
  label,
  amount,
  emphasized,
}: {
  label: string;
  amount: string | undefined;
  emphasized?: boolean;
}) {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText
        size={emphasized ? '$bodyMdMedium' : '$bodyMd'}
        color={emphasized ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
      <NumberSizeableTextWrapper
        hideValue
        formatter="balance"
        size={emphasized ? '$bodyMdMedium' : '$bodyMd'}
        color={emphasized ? '$text' : '$textSubdued'}
      >
        {amount ?? '-'}
      </NumberSizeableTextWrapper>
    </XStack>
  );
}

/**
 * Per-token public / private / total split for the STRK20 pool, plus the
 * opt-in entry and the sequencing cooldown countdown. Rendered only when the
 * vault settings declare a privacy pool.
 */
function StarknetPrivacyBlock({
  networkId,
  accountId,
  token,
  publicBalanceParsed,
}: IProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const { isAvailable, config, errorKey: availabilityErrorKey } =
    useStarknetPrivacyAvailability({ networkId, accountId });
  const { state, reload } = useStarknetPrivacyAccountState({
    networkId,
    accountId,
    enabled: isAvailable,
  });

  const registered = isStrk20Registered(state);
  const pending = isStrk20RegisterPending(state);
  const mismatch = isStrk20Mismatch(state);

  const { balances } = useStarknetPrivateBalances({
    networkId,
    accountId,
    tokenAddress: token.address,
    enabled: isAvailable && registered,
  });
  const { sequencing } = useStarknetPrivacySequencing({
    networkId,
    accountId,
    enabled: isAvailable && registered,
  });

  const { optIn, isOptingIn, optInErrorKey, optInRetryable } =
    useStarknetPrivacyOptIn({
      networkId,
      accountId,
      config,
      onRegisterSubmitted: reload,
    });
  // A non-retryable failure (e.g. screening rejection) must not invite the
  // user to press Enable again for the same, guaranteed-to-fail attempt.
  const canRetryOptIn = optInRetryable !== EStrk20ErrorRetry.No;

  const privateBalanceParsed = useMemo(() => {
    const raw = balances?.byToken?.[token.address.toLowerCase()];
    if (!raw) {
      return undefined;
    }
    return new BigNumber(raw).shiftedBy(-(token.decimals ?? 0)).toFixed();
  }, [balances?.byToken, token.address, token.decimals]);

  const totalBalanceParsed = useMemo(() => {
    if (publicBalanceParsed === undefined && privateBalanceParsed === undefined) {
      return undefined;
    }
    return new BigNumber(publicBalanceParsed ?? 0)
      .plus(privateBalanceParsed ?? 0)
      .toFixed();
  }, [privateBalanceParsed, publicBalanceParsed]);

  const isWaiting = isStrk20SequencingWaiting(sequencing);

  const openTransfer = useCallback(
    (kind: IStrk20TransferKind) => {
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendStarknetPrivateTransfer,
        params: { networkId, accountId, kind, token },
      });
    },
    [accountId, navigation, networkId, token],
  );

  // A clean `false` means the pool is not live here, so the feature stays
  // invisible. Only a failed probe is worth telling the user about.
  if (!isAvailable) {
    if (!availabilityErrorKey) {
      return null;
    }
    return (
      <Stack pb="$5">
        <SizableText size="$bodySm" color="$textSubdued">
          {formatMockMessage(intl, availabilityErrorKey)}
        </SizableText>
      </Stack>
    );
  }

  return (
    <Stack pb="$5">
      <YStack
        gap="$3"
        p="$4"
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$3"
      >
        <SizableText size="$headingSm">
          {formatMockMessage(
            intl,
            ETranslationsMock.starknet_privacy_private_transfers,
          )}
        </SizableText>

        {mismatch ? (
          <SizableText size="$bodyMd" color="$textCritical">
            {formatMockMessage(
              intl,
              ETranslationsMock.starknet_privacy_error_key_mismatch,
            )}
          </SizableText>
        ) : null}

        {!mismatch && !registered ? (
          <YStack gap="$3">
            <SizableText size="$bodyMd" color="$textSubdued">
              {formatMockMessage(
                intl,
                pending
                  ? ETranslationsMock.starknet_privacy_block_pending_desc
                  : ETranslationsMock.starknet_privacy_block_enable_desc,
              )}
            </SizableText>
            {pending || !canRetryOptIn ? null : (
              <Button
                size="small"
                variant="primary"
                alignSelf="flex-start"
                loading={isOptingIn}
                onPress={() => void optIn()}
                testID="starknet-privacy-enable"
              >
                {formatMockMessage(
                  intl,
                  ETranslationsMock.starknet_privacy_action_enable,
                )}
              </Button>
            )}
            {optInErrorKey ? (
              <SizableText size="$bodySm" color="$textCritical">
                {formatMockMessage(intl, optInErrorKey)}
              </SizableText>
            ) : null}
          </YStack>
        ) : null}

        {registered ? (
          <YStack gap="$3">
            <YStack gap="$1.5">
              <AmountRow
                label={formatMockMessage(
                  intl,
                  ETranslationsMock.starknet_privacy_balance_public,
                )}
                amount={publicBalanceParsed}
              />
              <AmountRow
                label={formatMockMessage(
                  intl,
                  ETranslationsMock.starknet_privacy_balance_private,
                )}
                amount={privateBalanceParsed}
              />
              <AmountRow
                emphasized
                label={formatMockMessage(
                  intl,
                  ETranslationsMock.starknet_privacy_balance_total,
                )}
                amount={totalBalanceParsed}
              />
            </YStack>

            {isWaiting ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {formatMockMessage(
                  intl,
                  ETranslationsMock.starknet_privacy_wait_countdown,
                  {
                    blocks: sequencing?.blocksRemaining ?? 0,
                    duration: formatStrk20Countdown(
                      sequencing?.estimatedSecondsRemaining ?? 0,
                    ),
                  },
                )}
              </SizableText>
            ) : null}

            <XStack gap="$2" flexWrap="wrap">
              <Button
                size="small"
                disabled={isWaiting}
                onPress={() => openTransfer('deposit')}
                testID="starknet-privacy-deposit"
              >
                {formatMockMessage(
                  intl,
                  ETranslationsMock.starknet_privacy_action_deposit,
                )}
              </Button>
              <Button
                size="small"
                disabled={isWaiting}
                onPress={() => openTransfer('withdraw')}
                testID="starknet-privacy-withdraw"
              >
                {formatMockMessage(
                  intl,
                  ETranslationsMock.starknet_privacy_action_withdraw,
                )}
              </Button>
              <Button
                size="small"
                disabled={isWaiting}
                onPress={() => openTransfer('transfer')}
                testID="starknet-privacy-send"
              >
                {formatMockMessage(
                  intl,
                  ETranslationsMock.starknet_privacy_action_send_private,
                )}
              </Button>
            </XStack>
          </YStack>
        ) : null}
      </YStack>
    </Stack>
  );
}

export default memo(StarknetPrivacyBlock);
