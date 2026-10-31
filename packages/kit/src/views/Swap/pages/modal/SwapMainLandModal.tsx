import { useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  EPageType,
  Page,
  SizableText,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import {
  EJotaiContextStoreNames,
  useSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { isSameUrlAccountAddress } from '../../hooks/useSwapAccount.utils';
import { invalidateSwapSupportAllAccounts } from '../../hooks/useSwapTokens';
import { invalidateUrlAccountTokenSelectorCache } from '../../utils/swapTokenSelectorCacheUtils';
import SwapMainLandWithPageType from '../components/SwapMainLand';

import type { RouteProp } from '@react-navigation/core';

const SwapMainLandModalPage = () => {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapMainLand>>();
  const {
    importAccountKey,
    importFromToken,
    importNetworkId,
    importUrlAccount,
    importToToken,
    swapTabSwitchType,
    fromAmount,
    importDeriveType,
    swapSource,
    marketPresetToken,
    marketSwapDirection,
    closeModalAfterSwapBroadcast,
    onSwapBroadcast,
  } = route.params ?? {};
  const urlAccountAddress = importUrlAccount?.address;
  const urlAccountNetworkId = importUrlAccount?.networkId;
  const { activeAccount } = useActiveAccount({
    num: 0,
  });
  const { updateSelectedAccountForSingletonAccount } =
    useAccountSelectorActions().current;
  const [urlSelectionApplied, setUrlSelectionApplied] =
    useState(!importUrlAccount);
  const [urlAccountOpened, setUrlAccountOpened] = useState(false);
  const [urlSelectionFailed, setUrlSelectionFailed] = useState(false);
  const [urlAccountVerified, setUrlAccountVerified] =
    useState(!importUrlAccount);
  const [urlAccountInvalid, setUrlAccountInvalid] = useState(false);
  useEffect(() => {
    if (!urlAccountAddress) return;
    let active = true;
    let generation = 0;
    const verify = () => {
      invalidateUrlAccountTokenSelectorCache();
      invalidateSwapSupportAllAccounts();
      generation += 1;
      const request = generation;
      setUrlAccountVerified(false);
      void backgroundApiProxy.serviceAccount
        .getUrlDBAccountSafe()
        .then((account) => {
          if (!active || request !== generation) return;
          const matches = isSameUrlAccountAddress({
            actual: account?.address,
            expected: urlAccountAddress,
            networkId: urlAccountNetworkId ?? '',
          });
          setUrlAccountInvalid(!matches);
          setUrlAccountVerified(matches);
        })
        .catch(() => {
          if (active && request === generation) setUrlAccountInvalid(true);
        });
    };
    appEventBus.on(EAppEventBusNames.AccountUpdate, verify);
    verify();
    return () => {
      active = false;
      appEventBus.off(EAppEventBusNames.AccountUpdate, verify);
    };
  }, [urlAccountAddress, urlAccountNetworkId]);
  useEffect(() => {
    if (!urlAccountAddress || !urlAccountNetworkId) return;
    let active = true;
    void updateSelectedAccountForSingletonAccount({
      num: 0,
      networkId: urlAccountNetworkId,
      walletId: WALLET_TYPE_WATCHING,
      othersWalletAccountId: accountUtils.URL_ACCOUNT_ID,
      shouldCommit: () => active,
    })
      .then(() => {
        if (active) setUrlSelectionApplied(true);
      })
      .catch(() => {
        if (active) setUrlSelectionFailed(true);
      });
    return () => {
      active = false;
    };
  }, [
    urlAccountAddress,
    urlAccountNetworkId,
    updateSelectedAccountForSingletonAccount,
  ]);
  const currentUrlAccountMatches = Boolean(
    importUrlAccount &&
    activeAccount.ready &&
    accountUtils.isUrlAccountFn({ accountId: activeAccount.account?.id }) &&
    isSameUrlAccountAddress({
      actual: activeAccount.account?.addressDetail?.address,
      expected: importUrlAccount.address,
      networkId: importUrlAccount.networkId,
    }) &&
    activeAccount.network?.id === importUrlAccount.networkId,
  );
  useEffect(() => {
    if (urlSelectionApplied && currentUrlAccountMatches)
      setUrlAccountOpened(true);
  }, [urlSelectionApplied, currentUrlAccountMatches]);
  const urlAccountMismatch = Boolean(
    importUrlAccount &&
    urlAccountOpened &&
    activeAccount.ready &&
    accountUtils.isUrlAccountFn({ accountId: activeAccount.account?.id }) &&
    !isSameUrlAccountAddress({
      actual: activeAccount.account?.addressDetail?.address,
      expected: importUrlAccount.address,
      networkId: importUrlAccount.networkId,
    }),
  );
  const needsUrlAccountVerification = Boolean(
    importUrlAccount &&
    (!urlAccountOpened ||
      accountUtils.isUrlAccountFn({ accountId: activeAccount.account?.id })),
  );
  const urlAccountError =
    urlSelectionFailed ||
    urlAccountMismatch ||
    (needsUrlAccountVerification && urlAccountInvalid);
  const [{ swapToAnotherAccountSwitchOn }, setSettings] = useSettingsAtom();
  useEffect(() => {
    // when modal swap open, reset swapToAnotherAccountSwitchOn
    if (swapToAnotherAccountSwitchOn) {
      setSettings((v) => ({
        ...v,
        swapToAnotherAccountSwitchOn: false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSettings]);
  useEffect(() => {
    if (importDeriveType && importNetworkId && activeAccount.ready) {
      void backgroundApiProxy.serviceNetwork.saveGlobalDeriveTypeForNetwork({
        networkId: importNetworkId,
        deriveType: importDeriveType,
      });
    }
  }, [importDeriveType, importNetworkId, activeAccount.ready]);

  useEffect(() => {
    if (swapSource) {
      defaultLogger.swap.enterSwap.enterSwap({
        enterFrom: swapSource,
      });
    }
  }, [swapSource]);

  const urlVerificationPending =
    needsUrlAccountVerification && !urlAccountVerified;
  const swapContent = (
    <SwapMainLandWithPageType
      pageType={EPageType.modal}
      storeName={
        importUrlAccount ? EJotaiContextStoreNames.swapUrlAccount : undefined
      }
      reviewContextKey={
        importUrlAccount
          ? [
              activeAccount.account?.id,
              activeAccount.account?.addressDetail?.address,
              activeAccount.network?.id,
              needsUrlAccountVerification && urlAccountVerified,
            ].join('|')
          : undefined
      }
      urlAccountAddress={importUrlAccount?.address}
      urlAccountNetworkId={importUrlAccount?.networkId}
      swapInitParams={{
        importAccountKey,
        importFromToken,
        importNetworkId,
        importToToken,
        swapTabSwitchType,
        fromAmount,
        marketPresetToken,
        marketSwapDirection,
        swapSource,
        closeModalAfterSwapBroadcast,
        onSwapBroadcast,
      }}
    />
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_trade })}
      />
      {urlAccountError ? (
        <SizableText>
          {intl.formatMessage({ id: ETranslations.global_an_error_occurred })}
        </SizableText>
      ) : null}
      {!urlAccountError &&
      importUrlAccount &&
      (!urlAccountOpened || urlVerificationPending) ? (
        <Spinner />
      ) : null}
      {!urlAccountError && !importUrlAccount ? swapContent : null}
      {!urlAccountError && importUrlAccount && urlAccountOpened ? (
        <Stack flex={1} display={urlVerificationPending ? 'none' : 'flex'}>
          {swapContent}
        </Stack>
      ) : null}
    </Page>
  );
};

export default function SwapMainLandModal() {
  const route =
    useRoute<RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapMainLand>>();
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: route.params?.importUrlAccount
          ? EAccountSelectorSceneName.swapUrlAccount
          : EAccountSelectorSceneName.swap,
      }}
      e2eContextProbeName="swap-main-modal"
      enabledNum={[0, 1]}
    >
      <SwapMainLandModalPage />
    </AccountSelectorProviderMirror>
  );
}
