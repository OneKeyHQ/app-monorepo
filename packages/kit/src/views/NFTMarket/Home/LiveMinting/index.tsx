import React, { FC, useEffect, useMemo, useState } from 'react';

import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
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
  const navigation = useNavigation<NavigationProps>();
  const defaultNetwork = useDefaultNetWork();
  const [selectedNetwork, setSelectedNetwork] =
    useState<Network>(defaultNetwork);
  const setContext = useLiveMintContext()?.setContext;
  const intl = useIntl();

  return (
    <Box flexDirection="row" justifyContent="space-between" mb="16px">
      <Text typography="Heading">Live Minting</Text>
      <HStack alignItems="center" space="20px">
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
        <Box m="-8px" mr="-12px">
          <Pressable
            onPress={() => {
              navigation.navigate(HomeRoutes.NFTMarketLiveMintingList, {
                network: selectedNetwork,
              });
            }}
            p="8px"
            rounded="xl"
            flexDirection="row"
            alignItems="center"
            _hover={{ bg: 'surface-hovered' }}
            _pressed={{ bg: 'surface-pressed' }}
          >
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              color="text-subdued"
              mr="4px"
            >
              {intl.formatMessage({
                id: 'action__see_all',
              })}
            </Text>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Pressable>
        </Box>
      </HStack>
    </Box>
  );
};

export const LiveMintingList = () => {
  const isSmallScreen = useIsVerticalLayout();
  const context = useLiveMintContext()?.context;
  const setContext = useLiveMintContext()?.setContext;
  const { serviceNFT } = backgroundApiProxy;

  const isFocused = useIsFocused();

  const shouldDoRefresh = useMemo((): boolean => {
    if (!context?.selectedNetwork?.id) {
      return false;
    }
    if (!isFocused) {
      return false;
    }
    return true;
  }, [context?.selectedNetwork?.id, isFocused]);

  const fetchData = async () => {
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
    return [];
  };

  const swrKey = 'liveMinting';
  useSWR(swrKey, fetchData, {
    refreshInterval: 30 * 1000,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    isPaused() {
      return !shouldDoRefresh;
    },
  });

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
