import { memo, useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { merge } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, Empty, useIsVerticalLayout } from '@onekeyhq/components';

import { notifyIfRiskToken } from '../../ManageTokens/helpers/TokenSecurityModalWrapper';
import AssetsList from '../../Wallet/AssetsList';
import SendNFTList from '../../Wallet/NFT/SendNFTList';
import { BaseSendModal } from '../components/BaseSendModal';
import SendTokenTabView from '../components/SendTokenTabView';
import { SendModalRoutes } from '../types';
import { useReloadAccountBalance } from '../utils/useReloadAccountBalance';

import type { SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.PreSendToken
>;
type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.PreSendToken>;

function PreSendTokenScreen() {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
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

  const sendTokenTabViewComponent = useCallback(() => {
    if (accountId) {
      return (
        <AssetsList
          accountId={accountId}
          networkId={networkId}
          showRoundTop
          singleton
          hidePriceInfo
          ListHeaderComponent={<Box h="24px" />}
          ListFooterComponent={<Box h="24px" />}
          contentContainerStyle={{
            paddingHorizontal: 0,
            marginTop: 0,
          }}
          onTokenPress={({ token }) => {
            navigation.navigate(
              SendModalRoutes.PreSendAddress,
              merge(
                {
                  from: '',
                  to: '',
                  amount: '',
                },
                transferInfo,
                {
                  token: token.tokenIdOnNetwork,
                  sendAddress: token.sendAddress,
                  to: undefined,
                  accountId,
                  networkId,
                },
              ),
            );
            notifyIfRiskToken(token);
          }}
        />
      );
    }
    return emptyView;
  }, [accountId, emptyView, navigation, networkId, transferInfo]);

  const sendNftsTabViewComponent = useCallback(
    () =>
      accountId ? (
        <SendNFTList networkId={networkId} accountId={accountId} />
      ) : (
        emptyView
      ),
    [accountId, emptyView, networkId],
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
      <SendTokenTabView
        options={[
          {
            label: 'token',
            title: 'Tokens',
            view: sendTokenTabViewComponent,
          },
          {
            label: 'nft',
            title: 'NFTs',
            view: sendNftsTabViewComponent,
          },
        ]}
      />
    </BaseSendModal>
  );
}

const PreSendToken = memo(PreSendTokenScreen);

export { PreSendToken };
