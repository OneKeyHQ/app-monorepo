import React, { useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { merge } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, Empty, useIsVerticalLayout } from '@onekeyhq/components';

import { notifyIfRiskToken } from '../../ManageTokens/helpers/TokenSecurityModalWrapper';
import AssetsList from '../../Wallet/AssetsList';
import SendNFTList from '../../Wallet/NFT/SendNFTList';
import { BaseSendModal } from '../components/BaseSendModal';
import SendTokenTabView from '../components/SendTokenTabView';
import { SendRoutes, SendRoutesParams } from '../types';
import { useReloadAccountBalance } from '../utils/useReloadAccountBalance';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.PreSendToken
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.PreSendToken>;

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
            view: () => {
              if (accountId) {
                return (
                  <AssetsList
                    hideSmallBalance={false}
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
                        SendRoutes.PreSendAddress,
                        merge(
                          {
                            from: '',
                            to: '',
                            amount: '',
                          },
                          transferInfo,
                          {
                            token: token.tokenIdOnNetwork,
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
            },
          },
          {
            label: 'nft',
            title: 'NFTs',
            view: () =>
              accountId ? (
                <SendNFTList networkId={networkId} accountId={accountId} />
              ) : (
                emptyView
              ),
          },
        ]}
      />
    </BaseSendModal>
  );
}

const PreSendToken = React.memo(PreSendTokenScreen);

export { PreSendToken };
