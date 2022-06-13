import React from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { merge } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, Empty } from '@onekeyhq/components';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks';

import AssetsList from '../Wallet/AssetsList';

import { BaseSendModal } from './components/BaseSendModal';
import { SendRoutes, SendRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.PreSendToken
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.PreSendToken>;

function PreSendToken() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { account } = useActiveWalletAccount();
  const route = useRoute<RouteProps>();
  const transferInfo = { ...route.params };

  return (
    <BaseSendModal
      height="auto"
      hidePrimaryAction
      hideSecondaryAction={false}
      footer={account ? undefined : null}
      header={intl.formatMessage({ id: 'action__select_token' })}
      scrollViewProps={{
        contentContainerStyle: account
          ? undefined
          : {
              flex: 1,
              justifyContent: 'center',
              paddingTop: 24,
              paddingBottom: 24,
            },
        children: account ? (
          <AssetsList
            singleton
            hidePriceInfo
            ListHeaderComponent={<Box h={8} />}
            ListFooterComponent={<Box h={8} />}
            contentContainerStyle={{
              paddingHorizontal: 0,
              marginTop: 0,
            }}
            onTokenPress={({ token }) => {
              console.log(token);
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
                  },
                ),
              );
            }}
          />
        ) : (
          <Empty
            imageUrl={IconAccount}
            title={intl.formatMessage({
              id: 'empty__no_account_title',
            })}
          />
        ),
      }}
    />
  );
}

export { PreSendToken };
