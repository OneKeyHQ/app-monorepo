import React, { FC, useCallback, useEffect, useState } from 'react';

import {
  NavigationProp,
  RouteProp,
  useIsFocused,
  useRoute,
} from '@react-navigation/core';
import { Button } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  Modal,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useNavigation from '../../hooks/useNavigation';

import { ScanQrcodeRoutes, ScanQrcodeRoutesParams, ScanResult } from './types';
import AccountSelector from '../../components/Header/AccountSelector';

const { isWeb, isNative: isApp } = platformEnv;

type ScanQrcodeRouteProp = RouteProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.SelectAccountAndNetwork
>;
type ScanQrcodeNavProp = NavigationProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.ScanQrcodeResult
>;
const SelectAccountAndNetwork: FC = () => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();

  const navigation = useNavigation<ScanQrcodeNavProp>();
  const route = useRoute<ScanQrcodeRouteProp>();

  return (
    <Modal
      hideSecondaryAction
      header={intl.formatMessage({
        id: 'title__select_an_account_and_network_to_continue',
      })}
      primaryActionProps={{
        children: intl.formatMessage({
          id: 'action__next',
        }),
      }}
      scrollViewProps={{
        pb: bottom,
        children: (
          <AccountSelector />
          // <Form>
          //   <Form.Item
          //     name="network"
          //     label={intl.formatMessage({ id: 'content__asset' })}
          //   >
          //     <Form.Select
          //       containerProps={{
          //         w: 'full',
          //       }}
          //       headerShown={false}
          //       footer={null}
          //       dropdownPosition="right"
          //     />
          //   </Form.Item>
          // </Form>
        ),
      }}
    />
  );
};
SelectAccountAndNetwork.displayName = 'SelectAccountAndNetwork';

export default SelectAccountAndNetwork;
