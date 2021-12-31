import React, { FC, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Select, useUserDevice } from '@onekeyhq/components';
import { useAppDispatch, useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManageNetwork';
import { updateActiveChainId } from '@onekeyhq/kit/src/store/reducers/chain';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.ManageNetworkModal
>;
const ChainSelector: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { size } = useUserDevice();
  const isHorizontal = ['LARGE', 'XLARGE'].includes(size);

  const dispatch = useAppDispatch();
  const activeChainId = useAppSelector((s) => s.chain.chainId);

  const handleActiveChainChange = useCallback(
    (chainId) => {
      dispatch(updateActiveChainId(chainId));
    },
    [dispatch],
  );

  const options = useMemo(
    () => [
      {
        title: 'EVM',
        options: [
          {
            label: 'Ethereum',
            value: 'ethereum',
            tokenProps: {
              chain: 'eth',
            },
          },
          {
            label: 'BSC',
            value: 'bsc',
            tokenProps: {
              chain: 'bsc',
            },
          },
          {
            label: 'HECO',
            value: 'heco',
            tokenProps: {
              chain: 'heco',
            },
          },
          {
            label: 'Polygon',
            value: 'polygon',
            tokenProps: {
              chain: 'polygon',
            },
          },
          {
            label: 'Fantom',
            value: 'fantom',
            tokenProps: {
              chain: 'fantom',
            },
          },
        ],
      },
    ],
    [],
  );

  return (
    <Box flex="1" w="full">
      <Select
        containerProps={{
          width: isHorizontal ? 248 : 'auto',
          alignSelf: 'flex-end',
        }}
        triggerProps={{
          width: 160,
        }}
        headerShown={false}
        dropdownPosition="left"
        value={activeChainId}
        onChange={handleActiveChainChange}
        options={options}
        footerText={intl.formatMessage({ id: 'action__customize_network' })}
        footerIcon="PencilOutline"
        onPressFooter={() =>
          navigation.navigate(ManageNetworkModalRoutes.ManageNetworkModal)
        }
      />
    </Box>
  );
};

export default ChainSelector;
