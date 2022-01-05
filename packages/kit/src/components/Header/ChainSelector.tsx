import React, { FC, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Select } from '@onekeyhq/components';
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
            label: 'ETH',
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
    <Box>
      <Select
        dropdownPosition="right"
        dropdownProps={{ w: '56' }}
        value={activeChainId}
        onChange={handleActiveChainChange}
        title="Networks"
        options={options}
        footerText={intl.formatMessage({ id: 'action__customize_network' })}
        footerIcon="PencilSolid"
        isTriggerPlain
        onPressFooter={() =>
          setTimeout(() => {
            navigation.navigate(ManageNetworkModalRoutes.ManageNetworkModal);
          }, 200)
        }
      />
    </Box>
  );
};

export default ChainSelector;
