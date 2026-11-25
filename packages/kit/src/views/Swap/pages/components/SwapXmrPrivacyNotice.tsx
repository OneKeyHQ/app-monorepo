import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { LocalWalletPasswordAlert } from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletPasswordAlert';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import { PRIVACY_CHAIN_SYNC_POLL_MS } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

import {
  XmrSwapPreflightError,
  assertXmrSwapBalance,
  assertXmrSwapSyncReady,
  readXmrSwapAmountAtomic,
} from '../../utils/xmrSwapExecution';

export function SwapXmrPrivacyNotice({
  accountId,
  networkId,
  walletId,
  fromAmount,
  onBalanceVerified,
}: {
  accountId: string;
  networkId: string;
  walletId?: string;
  fromAmount?: string;
  onBalanceVerified?: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isSource = fromAmount !== undefined;
  const scope = `${networkId}:${accountId}:${isSource}`;
  const { result, run } = usePromiseResult(
    async () => {
      const params = { accountId, networkId };
      const { servicePrivacyChain } = backgroundApiProxy;
      const state =
        await servicePrivacyChain.getLocalWalletAccountState(params);
      if (
        !isSource ||
        !state.enabled ||
        state.paused ||
        state.privacyDisabled
      ) {
        return { scope, state };
      }
      const [readiness, balance] = await Promise.all([
        servicePrivacyChain.getLocalWalletSendReadiness(params),
        servicePrivacyChain.getLocalWalletAccountBalance(params),
      ]);
      return { scope, state, readiness, balance };
    },
    [accountId, isSource, networkId, scope],
    {
      checkIsFocused: true,
      revalidateOnFocus: true,
      pollingInterval: isSource ? PRIVACY_CHAIN_SYNC_POLL_MS : undefined,
      undefinedResultIfError: true,
    },
  );
  if (result?.scope !== scope) return null;

  const { state, readiness, balance } = result;
  let message: string | undefined;
  let openSettings = false;
  if (isSource) {
    try {
      assertXmrSwapSyncReady({ state, readiness, intl });
    } catch (error) {
      if (!(error instanceof XmrSwapPreflightError)) throw error;
      message = error.message;
      openSettings =
        !state.privacyDisabled &&
        (!state.enabled || state.paused || readiness?.status === 'chainPaused');
    }
    const amountAtomic = readXmrSwapAmountAtomic(fromAmount);
    if (
      !message &&
      amountAtomic &&
      balance?.frozen?.some((part) => part.reason === 'confirming')
    ) {
      try {
        assertXmrSwapBalance({ amountAtomic, balance, pending: false, intl });
      } catch (error) {
        if (!(error instanceof XmrSwapPreflightError)) throw error;
        message = error.message;
      }
    }
    if (
      !message &&
      balance?.frozen?.some((part) => part.reason === 'needsPassword')
    ) {
      return (
        <LocalWalletPasswordAlert
          networkId={networkId}
          accountId={accountId}
          onVerified={() => {
            void run();
            onBalanceVerified?.();
          }}
        />
      );
    }
  } else if (!state.enabled || state.paused) {
    message = intl.formatMessage({
      id: ETranslations.privacy_receive_needs_sync__msg,
    });
    openSettings = !state.privacyDisabled;
  }
  if (!message) return null;

  return (
    <Alert
      testID="swap-xmr-privacy-notice"
      type={isSource ? 'warning' : 'default'}
      description={message}
      action={
        openSettings
          ? {
              primary: intl.formatMessage({
                id: ETranslations.global_settings,
              }),
              onPrimaryPress: () =>
                navigation.pushModal(EModalRoutes.SettingModal, {
                  screen: EModalSettingRoutes.SettingPrivacyNetwork,
                  params: { networkId, walletId },
                }),
            }
          : undefined
      }
    />
  );
}
