import React, { FC, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, Text, useIsVerticalLayout } from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { HomeRoutes, HomeRoutesParams } from '../../../../routes/types';
import ChainSelector from '../../ChainSelector';
import { useDefaultNetWork } from '../hook';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';
import {
  LiveMintListContext,
  LiveMintListContextValue,
  useLiveMintContext,
} from './context';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.NFTMarketLiveMintingList
>;

const ListHeader: FC = () => {
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const defaultNetwork = useDefaultNetWork();
  const [selectedNetwork, setSelectedNetwork] =
    useState<Network>(defaultNetwork);
  const setContext = useLiveMintContext()?.setContext;
  const intl = useIntl();

  return (
    <Box
      paddingX={isSmallScreen ? '16px' : 0}
      flexDirection="row"
      justifyContent="space-between"
      mb="12px"
    >
      <Text typography="Heading">Live Minting</Text>
      <Box flexDirection="row" alignItems="center">
        <ChainSelector
          selectedNetwork={selectedNetwork}
          onChange={(n) => {
            setSelectedNetwork(n);
            if (setContext) {
              setContext((ctx) => ({
                ...ctx,
                selectedNetwork: n,
              }));
            }
          }}
        />
        <Button
          onPress={() => {
            navigation.navigate(HomeRoutes.NFTMarketLiveMintingList, {
              network: selectedNetwork,
            });
          }}
          height="32px"
          type="plain"
          size="sm"
          textProps={{ color: 'text-subdued' }}
        >
          {intl.formatMessage({
            id: 'action__view_all',
          })}
        </Button>
      </Box>
    </Box>
  );
};

export const LiveMintingList = () => {
  const isSmallScreen = useIsVerticalLayout();
  const context = useLiveMintContext()?.context;
  const setContext = useLiveMintContext()?.setContext;
  const { serviceNFT } = backgroundApiProxy;
  useEffect(() => {
    (async () => {
      if (setContext) {
        setContext((ctx) => ({
          ...ctx,
          loading: true,
        }));
        const data = await serviceNFT.getLiveMinting({
          chain: context?.selectedNetwork?.id,
          limit: context?.isTab ? 5 : 20,
        });
        if (data) {
          setContext((ctx) => {
            const { isTab } = ctx;
            return {
              ...ctx,
              liveMintList: isTab ? data.slice(0, 5) : data,
              loading: false,
            };
          });
        } else {
          setContext((ctx) => ({
            ...ctx,
            liveMintList: [],
            loading: false,
          }));
        }
      }
    })();
  }, [context?.isTab, context?.selectedNetwork?.id, serviceNFT, setContext]);

  return isSmallScreen ? <Mobile /> : <Desktop />;
};

const LiveMintingModule = () => {
  const defaultNetwork = useDefaultNetWork();

  const [context, setContext] = useState<LiveMintListContextValue>({
    isTab: true,
    selectedNetwork: defaultNetwork,
  });
  return (
    <LiveMintListContext.Provider value={{ context, setContext }}>
      <ListHeader />
      <LiveMintingList />
    </LiveMintListContext.Provider>
  );
};

export default LiveMintingModule;
