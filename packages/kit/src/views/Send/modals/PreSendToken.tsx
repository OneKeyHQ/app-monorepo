import { memo, useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { merge } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, Empty, useIsVerticalLayout } from '@onekeyhq/components';
import flowLogger from '@onekeyhq/shared/src/logger/flowLogger/flowLogger';

import { LazyDisplayView } from '../../../components/LazyDisplayView';
import { useActiveSideAccount } from '../../../hooks';
import { notifyIfRiskToken } from '../../ManageTokens/helpers/TokenSecurityModalWrapper';
import { FullTokenAssetsList } from '../../Wallet/AssetsList';
import SendNFTList from '../../Wallet/NFT/SendNFTList';
import { BaseSendModal } from '../components/BaseSendModal';
import SendTokenTabView from '../components/SendTokenTabView';
import { SendModalRoutes } from '../types';
import { useReloadAccountBalance } from '../utils/useReloadAccountBalance';

import type { IAccountToken } from '../../Overview/types';
import type { ISendTokenTabViewItem } from '../components/SendTokenTabView';
import type { SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.PreSendToken
>;
type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.PreSendToken>;

function SendTokenTabViewComponent({
  accountId,
  networkId,
  emptyView,
}: {
  accountId: string;
  networkId: string;
  emptyView: JSX.Element | null;
}) {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const transferInfo = useMemo(() => ({ ...route.params }), [route.params]);

  const { walletId } = useActiveSideAccount({
    accountId,
    networkId,
  });

  const footer = useMemo(() => <Box h="24px" />, []);
  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: 0,
      marginTop: 0,
    }),
    [],
  );
  const onTokenPress = useCallback(
    ({ token }: { token: IAccountToken }) => {
      const params: typeof transferInfo = merge(
        {
          from: '',
          to: '',
          amount: '',
        },
        transferInfo,
        {
          token: token.address,
          sendAddress: token.sendAddress,
          to: undefined,
          accountId,
          networkId,
        },
      );
      navigation.navigate(SendModalRoutes.PreSendAddress, params);
      flowLogger.send.common.selectToken({
        from: params?.from,
        token: params?.token,
        tokenSendAddress: token?.sendAddress,
        tokenSymbol: token?.symbol,
        accountId,
        networkId,
      });
      notifyIfRiskToken(token);
    },
    [accountId, navigation, networkId, transferInfo],
  );
  if (accountId) {
    return (
      <>
        <Box h="24px" />
        <FullTokenAssetsList
          showSkeletonHeader={false}
          walletId={walletId}
          accountId={accountId}
          networkId={networkId}
          showRoundTop
          hidePriceInfo
          ListHeaderComponent={null}
          ListFooterComponent={footer}
          contentContainerStyle={contentContainerStyle}
          onTokenPress={onTokenPress}
        />
      </>
    );
  }
  return emptyView;
}

const SendTokenTabViewComponentMemo = memo(SendTokenTabViewComponent);

function PreSendTokenScreen() {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const transferInfo = useMemo(() => ({ ...route.params }), [route.params]);
  const { accountId, networkId } = transferInfo;

  useReloadAccountBalance({ accountId, networkId });

  const padding = isSmallScreen ? '16px' : '24px';
  const emptyView = useMemo(
    () => (
      <Empty
        emoji="💳"
        title={intl.formatMessage({
          id: 'empty__no_account_title',
        })}
      />
    ),
    [intl],
  );

  const sendNftsTabViewComponent = useCallback(
    () =>
      accountId ? (
        <SendNFTList networkId={networkId} accountId={accountId} />
      ) : (
        emptyView
      ),
    [accountId, emptyView, networkId],
  );
  const tokenTabView = useCallback(
    () => (
      <SendTokenTabViewComponentMemo
        accountId={accountId}
        networkId={networkId}
        emptyView={emptyView}
      />
    ),
    [accountId, emptyView, networkId],
  );

  const options: ISendTokenTabViewItem[] = useMemo(
    () => [
      {
        label: 'token',
        title: 'Tokens',
        view: tokenTabView,
      },
      {
        label: 'nft',
        title: 'NFTs',
        view: sendNftsTabViewComponent,
      },
    ],
    [sendNftsTabViewComponent, tokenTabView],
  );

  return (
    <BaseSendModal
      accountId={accountId}
      networkId={networkId}
      hidePrimaryAction
      height={560}
      hideSecondaryAction={false}
      header={intl.formatMessage({ id: 'action__send' })}
      footer={null}
      staticChildrenProps={{ flex: 1, paddingX: padding, paddingTop: padding }}
    >
      <LazyDisplayView delay={100}>
        <SendTokenTabView options={options} />
      </LazyDisplayView>
    </BaseSendModal>
  );
}

const PreSendToken = memo(PreSendTokenScreen);

export { PreSendToken };
