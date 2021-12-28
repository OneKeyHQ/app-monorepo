import React, { FC, useCallback, useMemo, useState } from 'react';

import { Box, Select, useUserDevice } from '@onekeyhq/components';
import { useAppDispatch, useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import { updateActiveChainId } from '@onekeyhq/kit/src/store/reducers/chain';

import ManageNetworks from '../../views/ManageNetworks';

const ChainSelector: FC = () => {
  const { size } = useUserDevice();
  const isHorizontal = ['LARGE', 'XLARGE'].includes(size);

  const dispatch = useAppDispatch();
  const activeChainId = useAppSelector((s) => s.chain.chainId);
  const [opened, setOpened] = useState(false);

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
        footerText="Customize"
        footerIcon="PencilOutline"
        onPressFooter={() => setOpened(true)}
      />
      <ManageNetworks opened={opened} onClose={() => setOpened(false)} />
    </Box>
  );
};

export default ChainSelector;
