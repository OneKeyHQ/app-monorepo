import React, { FC, useCallback, useMemo } from 'react';

import { Select, useUserDevice } from '@onekeyhq/components';
import { useAppDispatch, useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import { updateActiveChainId } from '@onekeyhq/kit/src/store/reducers/chain';

const ChainSelector: FC = () => {
  const dispatch = useAppDispatch();
  const activeChainId = useAppSelector((s) => s.chain.chainId);
  const { size } = useUserDevice();

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
    <Select
      containerProps={
        ['SMALL', 'NORMAL'].includes(size)
          ? {
              width: 'auto',
              mr: -2,
            }
          : {
              width: 248,
              mr: 2,
            }
      }
      triggerProps={{
        width: '140px',
      }}
      headerShown={false}
      dropdownPosition="left"
      value={activeChainId}
      onChange={handleActiveChainChange}
      options={options}
      footerText="Customize"
      footerIcon="PencilOutline"
    />
  );
};

export default ChainSelector;
