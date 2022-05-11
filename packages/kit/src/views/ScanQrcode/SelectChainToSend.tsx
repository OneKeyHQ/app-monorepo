/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  FC,
  ReactChildren,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Select,
  Token,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../hooks';
import {
  ModalRoutes,
  ModalRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../routes/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;
type SelectChainToSendProps = {
  address: string;
  possibleNetworks?: string[];
};
const SelectChainToSend: FC<SelectChainToSendProps> = ({
  address,
  possibleNetworks,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const { enabledNetworks = [] } = useManageNetworks();
  const { screenWidth } = useUserDevice();

  const options = enabledNetworks.map((network) => ({
    label: network.shortName,
    value: network.id,
    tokenProps: {
      src: network.logoURI,
      letter: network.shortName,
    },
    badge: network.impl === 'evm' ? 'EVM' : undefined,
  }));

  // TODO
  return <></>;
};
SelectChainToSend.displayName = 'SelectChainToSend';
export default SelectChainToSend;
