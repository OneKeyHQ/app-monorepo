/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable no-nested-ternary */
import React, { useLayoutEffect, useMemo, useRef } from 'react';

import { StyleSheet } from 'react-native';

import {
  Box,
  IconButton,
  Pressable,
  Token,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { FlatListRef } from '@onekeyhq/components/src/FlatList';
import { INetwork } from '@onekeyhq/engine/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { ManageNetworkRoutes } from '../../../views/ManageNetworks/types';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_NETWORK } from '../../Header/AccountSelectorChildren/accountSelectorConsts';
import { AllNetwork } from '../../Header/AccountSelectorChildren/RightChainSelector';
import { useAccountSelectorInfo } from '../hooks/useAccountSelectorInfo';

type IChainSelectorNetworkItem = {
  id: string;
  network: INetwork;
  logoURL: string;
  isActive: boolean;
};
function ChainSelector({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const navigation = useAppNavigation();
  const { serviceAccountSelector } = backgroundApiProxy;
  const { enabledNetworks } = useManageNetworks();
  const { selectedNetworkId } = accountSelectorInfo;
  const flatListRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const isScrolledRef = useRef(false);
  useLayoutEffect(() => {
    if (
      isScrolledRef.current ||
      !enabledNetworks ||
      !enabledNetworks.length ||
      !selectedNetworkId
    ) {
      return;
    }
    /* timeout required:
    scrollToIndex should be used in conjunction with getItemLayout or onScrollToIndexFailed, otherwise there is no way to know the location of offscreen indices or handle failures.
     */
    setTimeout(() => {
      try {
        const index = enabledNetworks.findIndex(
          (item) => item.id === selectedNetworkId,
        );
        if (index < 5) {
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        flatListRef?.current?.scrollToIndex?.({ animated: true, index });
        isScrolledRef.current = true;
      } catch (error) {
        debugLogger.common.error(error);
      }
    }, ACCOUNT_SELECTOR_AUTO_SCROLL_NETWORK);
  }, [enabledNetworks, selectedNetworkId]);

  // const options = useMemo(() => {
  //   if (!enabledNetworks) return [];
  //
  //   return enabledNetworks.map((network) => ({
  //     label: network.shortName,
  //     value: network.id,
  //     tokenProps: {
  //       src: network.logoURI,
  //       letter: network.shortName,
  //     },
  //     badge: network.impl === 'evm' ? 'EVM' : undefined,
  //   }));
  // }, [enabledNetworks]);

  const networkList = useMemo((): IChainSelectorNetworkItem[] => {
    if (!enabledNetworks) return [];
    // TODO sort by isActive
    //   origin sort by user custom network
    return enabledNetworks.map((network) => ({
      id: network.id,
      network,
      logoURL: network.logoURI,
      isActive: selectedNetworkId === network.id,
    }));
  }, [enabledNetworks, selectedNetworkId]);

  return (
    <>
      <Box
        alignSelf="stretch"
        borderRightWidth={StyleSheet.hairlineWidth}
        borderColor="border-subdued"
      >
        <FlatListRef
          // TODO auto scroll to active item
          ref={flatListRef}
          data={networkList}
          // @ts-expect-error
          keyExtractor={(item: IChainSelectorNetworkItem) => item.id}
          // @ts-expect-error
          renderItem={({
            item,
          }: {
            // eslint-disable-next-line react/no-unused-prop-types
            item: IChainSelectorNetworkItem;
          }) => (
            <Pressable
              onPress={() => {
                const id = (item.id === AllNetwork ? '' : item.id) || '';
                serviceAccountSelector.updateSelectedNetwork(id);
              }}
            >
              {({ isHovered, isPressed }) => (
                <Box
                  p={1.5}
                  m={1}
                  borderWidth={2}
                  borderColor={
                    item.isActive
                      ? 'interactive-default'
                      : isPressed
                      ? 'border-default'
                      : isHovered
                      ? 'border-subdued'
                      : 'transparent'
                  }
                  rounded="full"
                >
                  <Token size={8} src={item.logoURL} />
                </Box>
              )}
            </Pressable>
          )}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, padding: 4 }}
        />
        <Box
          p={2}
          mb={insets.bottom}
          borderTopWidth={StyleSheet.hairlineWidth}
          borderColor="border-subdued"
        >
          <IconButton
            name="CogOutline"
            size="xl"
            type="plain"
            circle
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.ManageNetwork,
                params: { screen: ManageNetworkRoutes.Listing },
              });
            }}
          />
        </Box>
      </Box>
    </>
  );
}

export default ChainSelector;
