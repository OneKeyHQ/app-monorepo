import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Image,
  Page,
  Text,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import useFormatDate from '../../../../hooks/useFormatDate';
import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapHistoryTokenInfoItem from '../../components/SwapHistoryTokenInfoItem';
import SwapTxHistoryViewInBrowser from '../../components/SwapHistoryTxViewInBrowser';
import SwapOnChainInfoItem from '../../components/SwapOnChainInfoItem';
import SwapTxHistoryStatusItem from '../../components/SwapTxHistoryStatusItem';
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
  const { formatDate } = useFormatDate();
  const onSwapAgain = useCallback(() => {
    // todo swap again actions
  }, []);
  const onCopy = useCallback((copyText: string) => {
    // todo copy actions
  }, []);
  const onViewInBrowser = useCallback(() => {}, []);
  const onSupport = useCallback(() => {}, []);
  const onShare = useCallback(() => {}, []);
  return (
    <Page scrollEnabled>
      {txHistory ? (
        <>
          <YStack separator space="$4" px="$4">
            <SwapTxHistoryStatusItem
              item={txHistory}
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
              <Text>ON-CHAIN INFO</Text>
              <SwapOnChainInfoItem
                title="Send"
                value={txHistory.txInfo.sender}
                onCopy={() => {
                  onCopy(txHistory.txInfo.sender);
                }}
              />
              <SwapOnChainInfoItem
                title="Receive"
                value={txHistory.txInfo.receiver}
                onCopy={() => {
                  onCopy(txHistory.txInfo.receiver);
                }}
              />
              <SwapOnChainInfoItem
                title="Hash"
                value={txHistory.txInfo.txId}
                onCopy={() => {
                  onCopy(txHistory.txInfo.txId);
                }}
              />
              <SwapCommonInfoItem
                title="Network Fee"
                value={`${txHistory.txInfo.netWorkFee ?? 0} ${
                  txHistory.baseInfo.fromNetwork?.symbol ?? '-'
                }`}
              />
            </YStack>
            <YStack>
              <Text>TIME</Text>
              <SwapCommonInfoItem
                title="Created"
                value={formatDate(new Date(txHistory.date.created))}
              />
              <SwapCommonInfoItem
                title="updated"
                value={formatDate(new Date(txHistory.date.updated))}
              />
            </YStack>
            <XStack justifyContent="space-between">
              <XStack>
                <Image
                  resizeMode="contain"
                  source={require('../../../../../assets/logo.png')}
                />
                <Text>OneKey</Text>
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
            <Button flex={1} icon="ShareArrowSolid" onPress={onShare}>
              {intl.formatMessage({ id: 'action__share' })}
            </Button>
          </XStack>
        </>
      ) : null}
    </Page>
  );
};

export default withSwapProvider(SwapHistoryDetailModal);
