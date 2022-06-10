import React from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { merge } from 'lodash';
import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';

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
  const route = useRoute<RouteProps>();
  const transferInfo = { ...route.params };

  return (
    <BaseSendModal
      height="auto"
      hidePrimaryAction
      hideSecondaryAction={false}
      header={intl.formatMessage({ id: 'action__select_token' })}
      scrollViewProps={{
        children: (
          <>
            <AssetsList
              singleton
              ListHeaderComponent={<Box />}
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
          </>
        ),
      }}
    />
  );
}

export { PreSendToken };
