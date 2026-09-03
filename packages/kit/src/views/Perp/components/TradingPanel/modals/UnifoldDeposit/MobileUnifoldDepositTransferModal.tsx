// cspell: words unifold Unifold
import { useCallback, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  type IPageNavigationProp,
  NavBackButton,
  Page,
  Stack,
  glassBarItem,
  useBackHandler,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import type {
  IUnifoldSupportedAsset,
  IUnifoldSupportedAssetChain,
} from '@onekeyhq/shared/types/unifoldDeposit';

import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../../PerpDialogLayout';

import { MobileUnifoldSourceSelectorContent } from './MobileUnifoldSourceSelectorContent';
import {
  type IUnifoldTransferContentRef,
  UnifoldTransferContent,
} from './UnifoldTransferContent';

import type { RouteProp } from '@react-navigation/core';

type IMobileUnifoldFlowStep = 'transfer' | 'token' | 'chain';
const MOBILE_PAGE_SCROLL_PROPS = {
  contentContainerStyle: { flexGrow: 1 },
} as const;

export default function MobileUnifoldDepositTransferModal() {
  const intl = useIntl();
  const navigation = useNavigation<IPageNavigationProp<IModalPerpParamList>>();
  const transferContentRef = useRef<IUnifoldTransferContentRef>(null);
  const route =
    useRoute<
      RouteProp<
        IModalPerpParamList,
        EModalPerpRoutes.MobileUnifoldDepositTransfer
      >
    >();
  const [flowHistory, setFlowHistory] = useState<IMobileUnifoldFlowStep[]>(() =>
    route.params?.openSourceSelectorOnReady ? ['token'] : ['transfer'],
  );
  const currentFlowStep = flowHistory[flowHistory.length - 1] ?? 'transfer';
  const initialSelectorMode =
    currentFlowStep === 'transfer' ? null : currentFlowStep;
  const isTransientSelector = flowHistory.includes('transfer');
  const [initialSelectorAssets, setInitialSelectorAssets] = useState<
    IUnifoldSupportedAsset[] | undefined
  >(undefined);
  const [initialSelectedAssetSymbol, setInitialSelectedAssetSymbol] = useState<
    string | undefined
  >(undefined);
  const [initialSelectedChain, setInitialSelectedChain] = useState<
    IUnifoldSupportedAssetChain | undefined
  >(undefined);
  const expectedRecipient = route.params?.expectedRecipient;
  const goBack = useCallback(() => {
    if (flowHistory.length > 1) {
      setFlowHistory((current) => current.slice(0, -1));
      return;
    }
    navigation.goBack();
  }, [flowHistory.length, navigation]);
  const handleSystemBackPress = useCallback(() => {
    goBack();
    return true;
  }, [goBack]);
  useBackHandler(
    handleSystemBackPress,
    platformEnv.isNativeAndroid &&
      (Boolean(initialSelectorMode) || flowHistory.length > 1),
  );
  const renderBackHeaderLeft = useCallback(
    () => <NavBackButton onPress={goBack} />,
    [goBack],
  );
  const pushFlowStep = useCallback((step: IMobileUnifoldFlowStep) => {
    setFlowHistory((current) =>
      current[current.length - 1] === step ? current : [...current, step],
    );
  }, []);
  const showInitialTokenSelector = useCallback(() => {
    pushFlowStep('token');
  }, [pushFlowStep]);
  const showInitialChainSelector = useCallback(() => {
    pushFlowStep('chain');
  }, [pushFlowStep]);
  const closeTransientSelector = useCallback(() => {
    setFlowHistory((current) => {
      const transferIndex = current.lastIndexOf('transfer');
      return transferIndex === -1
        ? current
        : current.slice(0, transferIndex + 1);
    });
  }, []);
  const showTransferUnavailableState = useCallback(() => {
    setFlowHistory((current) => {
      const transferIndex = current.lastIndexOf('transfer');
      return transferIndex === -1
        ? ['transfer']
        : current.slice(0, transferIndex + 1);
    });
  }, []);
  const clearSourceSelectorResult = useCallback(() => {
    navigation.setParams({ sourceSelectorResult: undefined });
  }, [navigation]);
  const openTracker = useCallback(() => {
    if (!expectedRecipient) {
      return;
    }
    navigation.push(EModalPerpRoutes.MobileUnifoldDepositTracker, {
      expectedRecipient,
      openedFromTransfer: true,
    });
  }, [expectedRecipient, navigation]);
  const prepareInitialSourceSelector = useCallback(
    ({
      assets,
      asset,
      chain,
    }: {
      assets: IUnifoldSupportedAsset[];
      asset: IUnifoldSupportedAsset;
      chain: IUnifoldSupportedAssetChain;
    }) => {
      setInitialSelectorAssets(assets);
      if (currentFlowStep === 'transfer') {
        setInitialSelectedAssetSymbol(asset.symbol);
        setInitialSelectedChain(chain);
      } else {
        setInitialSelectedAssetSymbol((current) => current ?? asset.symbol);
        setInitialSelectedChain((current) => current ?? chain);
      }
    },
    [currentFlowStep],
  );
  const isInitialSelectorVisible = initialSelectorMode !== null;
  let headerTitleId = ETranslations.perp_unifold_transfer_crypto__title;
  const headerLeft = renderBackHeaderLeft;
  if (initialSelectorMode === 'token') {
    headerTitleId = ETranslations.token_selector_title;
  } else if (initialSelectorMode === 'chain') {
    headerTitleId = ETranslations.global_select_network;
  }
  const buildNativeHeaderLeftItems = useCallback(
    () => [glassBarItem(headerLeft())],
    [headerLeft],
  );

  return (
    <Page scrollEnabled scrollProps={MOBILE_PAGE_SCROLL_PROPS} safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({ id: headerTitleId })}
        {...(platformEnv.isNativeIOS26Plus
          ? {
              scrollEdgeEffects: { top: 'hidden' },
              unstable_headerLeftItems: buildNativeHeaderLeftItems,
            }
          : { headerLeft })}
      />
      <Page.Body
        flex={1}
        minHeight={0}
        position="relative"
        {...PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS}
      >
        <Stack px="$4">
          <UnifoldTransferContent
            ref={transferContentRef}
            expectedRecipient={expectedRecipient}
            onOpenTracker={openTracker}
            analyticsEntrySource={route.params?.analyticsEntrySource}
            trackDefaultSourceSelection={
              !route.params?.openSourceSelectorOnReady
            }
            sourceSelectorResult={route.params?.sourceSelectorResult}
            onSourceSelectorResultHandled={clearSourceSelectorResult}
            onSourceSelectorReady={prepareInitialSourceSelector}
            onSourceSelectorUnavailable={
              isInitialSelectorVisible
                ? showTransferUnavailableState
                : undefined
            }
            useExternalHeader
            onOpenMobileTokenSelector={showInitialTokenSelector}
            onOpenMobileChainSelector={showInitialChainSelector}
          />
        </Stack>
        {initialSelectorMode ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            right={0}
            zIndex={1}
            bg="$bgApp"
          >
            <MobileUnifoldSourceSelectorContent
              key={initialSelectorMode}
              mode={initialSelectorMode}
              assets={initialSelectorAssets}
              loading={!initialSelectorAssets}
              selectedAssetSymbol={initialSelectedAssetSymbol}
              selectedChainType={initialSelectedChain?.chain_type}
              selectedChainId={initialSelectedChain?.chain_id}
              onSelectToken={(asset) => {
                setInitialSelectedAssetSymbol(asset.symbol);
                if (isTransientSelector) {
                  const chain =
                    asset.chains.find(
                      (item) =>
                        item.chain_type === initialSelectedChain?.chain_type &&
                        item.chain_id === initialSelectedChain?.chain_id,
                    ) ?? asset.chains[0];
                  if (!chain) {
                    return;
                  }
                  setInitialSelectedChain(chain);
                  transferContentRef.current?.selectSource(asset, chain);
                  navigation.setParams({
                    openSourceSelectorOnReady: undefined,
                  });
                  closeTransientSelector();
                  return;
                }
                setInitialSelectedChain(undefined);
                pushFlowStep('chain');
              }}
              onSelectChain={(asset, chain) => {
                setInitialSelectedAssetSymbol(asset.symbol);
                setInitialSelectedChain(chain);
                transferContentRef.current?.selectSource(asset, chain);
                navigation.setParams({ openSourceSelectorOnReady: undefined });
                if (isTransientSelector) {
                  closeTransientSelector();
                } else {
                  pushFlowStep('transfer');
                }
              }}
            />
          </Stack>
        ) : null}
      </Page.Body>
    </Page>
  );
}
