import { memo, useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ActionItem,
  RawActions,
} from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import {
  isStrk20RegisterPending,
  isStrk20Registered,
  useStarknetPrivacyAccountState,
  useStarknetPrivacyAvailability,
  useStarknetPrivateBalances,
} from '@onekeyhq/kit/src/views/StarknetPrivacy/hooks/useStarknetPrivacy';
import { useStarknetPrivacyOptIn } from '@onekeyhq/kit/src/views/StarknetPrivacy/hooks/useStarknetPrivacyOptIn';
import {
  formatMockMessage,
  getStarknetPrivateBalanceParsed,
  resolveStarknetPrivacyPhase,
} from '@onekeyhq/kit/src/views/StarknetPrivacy/utils/starknetPrivacyUtils';
import type { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import {
  EStrk20AccountPhase,
  EStrk20ErrorRetry,
  EStrk20OptInStatus,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IStrk20TransferKind } from '@onekeyhq/shared/types/starknetPrivacy';
import type { IToken } from '@onekeyhq/shared/types/token';

import TokenDetailsBalanceHero from '../TokenDetailsBalanceHero';
import { TokenPrivacyPanel } from '../TokenPrivacyPanel';

type IProps = {
  networkId: string;
  accountId: string;
  token: IToken;
  publicBalanceParsed?: string;
  price?: number;
  currency?: string;
  accountAddress: string;
  onReceive: () => void | Promise<void>;
  receiveDisabled?: boolean;
  allowReceiveWhenDisabled?: boolean;
};

function StarknetPrivacyBlock({
  networkId,
  accountId,
  token,
  publicBalanceParsed,
  price,
  currency,
  accountAddress,
  onReceive,
  receiveDisabled,
  allowReceiveWhenDisabled,
}: IProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    isAvailable,
    errorKey: availabilityErrorKey,
    isLoading: availabilityLoading,
  } = useStarknetPrivacyAvailability({ networkId, accountId });
  const {
    state,
    reload,
    errorKey: stateErrorKey,
    isLoading: stateLoading,
  } = useStarknetPrivacyAccountState({
    networkId,
    accountId,
    enabled: isAvailable,
  });
  const registered = isStrk20Registered(state);
  const pending = isStrk20RegisterPending(state);
  const isResuming = Boolean(state?.registeredPublicKey);
  const {
    balances,
    errorCode: balanceErrorCode,
    isLoading: balanceLoading,
    isRefreshing: balanceRefreshing,
    reload: reloadBalances,
    refreshSilently,
    lastSyncedAt,
  } = useStarknetPrivateBalances({
    networkId,
    accountId,
    tokenAddress: token.address,
    enabled: isAvailable && registered,
  });
  const phase = resolveStarknetPrivacyPhase({
    isAvailable,
    state,
    balanceErrorCode,
  });
  const { optIn, isOptingIn, optInErrorKey, optInRetryable } =
    useStarknetPrivacyOptIn({
      networkId,
      accountId,
      isResuming,
      onRegisterSubmitted: reload,
    });
  const optInBlocked =
    Boolean(optInErrorKey) && optInRetryable === EStrk20ErrorRetry.No;
  const privateBalanceParsed = getStarknetPrivateBalanceParsed({
    balances,
    tokenAddress: token.address,
    decimals: token.decimals,
  });
  const openTransfer = useCallback(
    (kind: IStrk20TransferKind) => {
      const params = {
        networkId,
        accountId,
        token,
        isNFT: false,
        starknetPrivacyKind: kind,
      };
      if (kind === 'transfer') {
        navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: EModalSignatureConfirmRoutes.TxDataInput,
          params,
        });
      } else {
        navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: EModalSignatureConfirmRoutes.TxAmountInput,
          params: {
            ...params,
            recipientAddress: accountAddress,
          },
        });
      }
    },
    [accountAddress, accountId, navigation, networkId, token],
  );
  const lastTransfer = state?.lastTransfer;
  const previousTransfer = useRef(lastTransfer);
  useEffect(() => {
    const previous = previousTransfer.current;
    previousTransfer.current = lastTransfer;
    if (
      previous?.status === 'pending' &&
      lastTransfer?.status === 'confirmed' &&
      previous.txid === lastTransfer.txid
    ) {
      refreshSilently();
    }
  }, [lastTransfer, refreshSilently]);
  if (
    (availabilityLoading && !registered) ||
    (isAvailable && stateLoading && !registered && !pending)
  ) {
    return <TokenPrivacyPanel state="preparing" />;
  }
  if (phase === EStrk20AccountPhase.Unavailable) {
    return (
      <TokenPrivacyPanel
        state={availabilityErrorKey ? 'error' : 'disabled'}
        title={formatMockMessage(
          intl,
          availabilityErrorKey ?? ETranslations.global_not_available,
        )}
        description=""
      />
    );
  }
  const isMismatch = phase === EStrk20AccountPhase.KeyMismatch;
  const accountErrorKey = isMismatch
    ? ETranslations.starknet_privacy_error_key_mismatch__msg
    : stateErrorKey;
  if (accountErrorKey) {
    return (
      <TokenPrivacyPanel
        state="error"
        title={formatMockMessage(intl, accountErrorKey)}
        onSync={isMismatch ? undefined : reload}
      />
    );
  }
  if (phase === EStrk20AccountPhase.Registering) {
    return (
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        testID="starknet-privacy-registration-pending"
      >
        {intl.formatMessage({ id: ETranslations.global_confirming })}
      </SizableText>
    );
  }
  if (
    phase === EStrk20AccountPhase.NotOptedIn ||
    phase === EStrk20AccountPhase.Activating ||
    phase === EStrk20AccountPhase.ActivationRequired
  ) {
    const hasConsent = state?.optInStatus === EStrk20OptInStatus.Consented;
    let titleKey: ETranslations | ETranslationsMock =
      ETranslations.privacy_enable__title;
    let descriptionKey: ETranslations | ETranslationsMock | undefined;
    let actionLabel: ETranslations | undefined;
    if (isResuming) {
      titleKey = ETranslations.privacy_sync_menu__title;
      actionLabel = ETranslations.global_resume;
    } else if (state?.registerTxFailed) {
      descriptionKey = ETranslations.swap_review_transaction_failed;
      actionLabel = ETranslations.global_retry;
    } else if (hasConsent) {
      actionLabel = ETranslations.global_continue;
    }

    const reasonKey = optInErrorKey ?? descriptionKey;
    return (
      <TokenPrivacyPanel
        state="disabled"
        title={formatMockMessage(intl, titleKey)}
        description={reasonKey ? formatMockMessage(intl, reasonKey) : ''}
        onEnable={() => void optIn()}
        enableUnavailable={optInBlocked}
        busy={isOptingIn}
        actionLabel={
          actionLabel ? intl.formatMessage({ id: actionLabel }) : undefined
        }
      />
    );
  }

  const canSpendPrivate =
    !balanceErrorCode &&
    new BigNumber(privateBalanceParsed ?? 0).isGreaterThan(0);
  const fiatValue =
    privateBalanceParsed !== undefined &&
    new BigNumber(price ?? NaN).isGreaterThan(0)
      ? new BigNumber(privateBalanceParsed).times(price ?? 0).toFixed()
      : undefined;

  const isLocked = phase === EStrk20AccountPhase.KeyLocked;
  return (
    <YStack testID="starknet-privacy-private" gap="$4">
      <TokenDetailsBalanceHero
        isLoading={!!balanceLoading && !balances}
        currency={currency}
        fiatValue={fiatValue}
        balanceParsed={privateBalanceParsed}
        sync={
          isLocked
            ? undefined
            : {
                isRefreshing: balanceRefreshing,
                onRefresh: reloadBalances,
                lastSyncedAt,
              }
        }
      />
      {isLocked ? (
        <Button
          testID="starknet-privacy-unlock"
          alignSelf="flex-start"
          size="small"
          variant="secondary"
          loading={balanceRefreshing}
          disabled={balanceRefreshing}
          onPress={reloadBalances}
        >
          {intl.formatMessage({ id: ETranslations.global_unlock })}
        </Button>
      ) : null}
      <RawActions flexWrap="wrap">
        <RawActions.Send
          testID="starknet-privacy-send"
          disabled={!canSpendPrivate}
          onPress={() => openTransfer('transfer')}
        />
        <RawActions.Receive
          testID="starknet-privacy-receive"
          disabled={receiveDisabled}
          allowPressWhenDisabled={allowReceiveWhenDisabled}
          onPress={onReceive}
          trackID="wallet-token-details-receive"
        />
        <ActionItem
          testID="starknet-privacy-deposit"
          icon="ShieldOutline"
          label={intl.formatMessage({
            id: ETranslations.privacy_balance_shield__action,
          })}
          disabled={publicBalanceParsed === undefined}
          onPress={() => openTransfer('deposit')}
        />
        <ActionItem
          testID="starknet-privacy-withdraw"
          icon="ArrowTopOutline"
          label={intl.formatMessage({
            id: ETranslations.privacy_balance_unshield__action,
          })}
          disabled={!canSpendPrivate}
          onPress={() => openTransfer('withdraw')}
        />
      </RawActions>
    </YStack>
  );
}

export default memo(StarknetPrivacyBlock);
