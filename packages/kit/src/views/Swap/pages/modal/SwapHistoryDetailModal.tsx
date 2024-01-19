import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import * as Clipboard from 'expo-clipboard';
import { useIntl } from 'react-intl';
import ViewShot from 'react-native-view-shot';

import {
  Button,
  Icon,
  Image,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { openUrlExternal } from '@onekeyhq/kit/src/utils/openUrl';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapHistoryTokenInfoItem from '../../components/SwapHistoryTokenInfoItem';
import SwapTxHistoryViewInBrowser from '../../components/SwapHistoryTxViewInBrowser';
import SwapOnChainInfoItem from '../../components/SwapOnChainInfoItem';
import SwapProviderInfoItem from '../../components/SwapProviderInfoItem';
import SwapRateInfoItem from '../../components/SwapRateInfoItem';
import SwapTxHistoryStatusItem from '../../components/SwapTxHistoryStatusItem';
import {
  useSwapTxHistoryActions,
  useSwapTxHistoryDetailParser,
  useSwapTxHistoryShare,
} from '../../hooks/useSwapTxHistory';
import { withSwapProvider } from '../WithSwapProvider';

import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '../../router/Routers';
import type { RouteProp } from '@react-navigation/core';

const SwapHistoryDetailModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryDetail>
    >();
  const intl = useIntl();
  const { txHistory } = route.params ?? {};
  const { swapAgainUseHistoryItem } = useSwapTxHistoryActions();
  const onSwapAgain = useCallback(() => {
    swapAgainUseHistoryItem(txHistory);
    navigation.popStack();
  }, [navigation, swapAgainUseHistoryItem, txHistory]);
  const onCopy = useCallback(async (copyText: string) => {
    await Clipboard.setStringAsync(copyText);
    Toast.success({ title: 'success', message: 'copied' });
  }, []);
  const onViewInBrowser = useCallback((url: string) => {
    openUrlExternal(url);
  }, []);
  const onSupport = useCallback(() => {}, []);
  const {
    statusLabel,
    usedTime,
    onCopyDetailInfo,
    createDateTime,
    updateDateTime,
    networkFee,
    protocolFee,
    oneKeyFee,
  } = useSwapTxHistoryDetailParser(txHistory);

  const { onShare, captureViewRef, enableShare } = useSwapTxHistoryShare();

  return (
    <Page scrollEnabled>
      {txHistory ? (
        <ViewShot
          ref={captureViewRef}
          options={{ format: 'jpg', quality: 0.9 }}
          captureMode="mount"
        >
          <>
            <YStack separator space="$4" px="$4">
              <SwapTxHistoryStatusItem
                status={txHistory.status}
                statusTitle={statusLabel}
                usedTime={usedTime}
                onSwapAgain={onSwapAgain}
              />
              <YStack>
                <SwapHistoryTokenInfoItem
                  token={txHistory.baseInfo.fromToken}
                  network={txHistory.baseInfo.fromNetwork}
                  amount={txHistory.baseInfo.fromAmount}
                />
                <Icon name="ChevronDoubleDownOutline" size="$10" />
                <SwapHistoryTokenInfoItem
                  token={txHistory.baseInfo.toToken}
                  network={txHistory.baseInfo.toNetwork}
                  amount={txHistory.baseInfo.toAmount}
                />
              </YStack>
              <YStack>
                <SizableText>ON-CHAIN INFO</SizableText>
                <SwapOnChainInfoItem
                  title="Send"
                  value={txHistory.txInfo.sender}
                  onCopy={() => {
                    void onCopy(txHistory.txInfo.sender);
                  }}
                />
                <SwapOnChainInfoItem
                  title="Receive"
                  value={txHistory.txInfo.receiver}
                  onCopy={() => {
                    void onCopy(txHistory.txInfo.receiver);
                  }}
                />
                <SwapOnChainInfoItem
                  title="Hash"
                  value={txHistory.txInfo.txId}
                  onCopy={() => {
                    void onCopy(txHistory.txInfo.txId);
                  }}
                />
                {networkFee && (
                  <SwapCommonInfoItem title="Network Fee" value={networkFee} />
                )}
              </YStack>
              <YStack>
                <SizableText>SWAP INFO</SizableText>
                <SwapRateInfoItem
                  rate={txHistory.swapInfo.instantRate}
                  fromToken={txHistory.baseInfo.fromToken}
                  toToken={txHistory.baseInfo.toToken}
                />
                <SwapProviderInfoItem
                  providerIcon={txHistory.swapInfo.provider.providerLogo ?? ''}
                  providerName={txHistory.swapInfo.provider.providerName}
                />
                {protocolFee && (
                  <SwapCommonInfoItem
                    title="Protocol Fee"
                    value={protocolFee}
                  />
                )}
                {oneKeyFee && (
                  <SwapCommonInfoItem title="OneKey Fee" value={oneKeyFee} />
                )}
              </YStack>
              <YStack>
                <SizableText>TIME</SizableText>
                <SwapCommonInfoItem title="Created" value={createDateTime} />
                <SwapCommonInfoItem title="updated" value={updateDateTime} />
              </YStack>
              <XStack justifyContent="space-between">
                <XStack>
                  <Image
                    resizeMode="contain"
                    source={require('../../../../../assets/logo.png')}
                  />
                  <SizableText>OneKey</SizableText>
                </XStack>
                <SwapTxHistoryViewInBrowser
                  item={txHistory}
                  onViewInBrowser={onViewInBrowser}
                />
              </XStack>
            </YStack>
            <XStack space="$2" my="$4" flex={1} px="$4">
              <Button flex={1} icon="HelpSupportOutline" onPress={onSupport}>
                {intl.formatMessage({ id: 'action__support' })}
              </Button>
              {enableShare && (
                <Button
                  flex={1}
                  icon="ShareArrowSolid"
                  onPress={onShare}
                  onLongPress={onCopyDetailInfo}
                >
                  {intl.formatMessage({ id: 'action__share' })}
                </Button>
              )}
            </XStack>
          </>
        </ViewShot>
      ) : null}
    </Page>
  );
};

export default withSwapProvider(SwapHistoryDetailModal);
