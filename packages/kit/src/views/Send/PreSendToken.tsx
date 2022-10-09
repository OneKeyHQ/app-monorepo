import React from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { merge } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, Empty, useIsVerticalLayout } from '@onekeyhq/components';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks';

import AssetsList from '../Wallet/AssetsList';
import SendNFTList from '../Wallet/NFT/SendNFTList';

import { BaseSendModal } from './components/BaseSendModal';
import SendTokenTabView from './components/SendTokenTabView';
import { SendRoutes, SendRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.PreSendToken
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.PreSendToken>;

function PreSendToken() {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();

  const navigation = useNavigation<NavigationProps>();
  const { account } = useActiveWalletAccount();
  const route = useRoute<RouteProps>();
  const transferInfo = { ...route.params };
  const padding = isSmallScreen ? '16px' : '24px';
  return (
    <BaseSendModal
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
              if (account) {
                return (
                  <AssetsList
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
                          },
                        ),
                      );
                    }}
                  />
                );
              }
              return (
                <Empty
                  imageUrl={IconAccount}
                  title={intl.formatMessage({
                    id: 'empty__no_account_title',
                  })}
                />
              );
            },
          },
          {
            label: 'nft',
            title: 'NFTs',
            view: () => <SendNFTList />,
          },
        ]}
      />
    </BaseSendModal>
  );
}

export { PreSendToken };
