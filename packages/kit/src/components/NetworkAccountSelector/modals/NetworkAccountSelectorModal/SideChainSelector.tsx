/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable no-nested-ternary */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Empty,
  HStack,
  Icon,
  IconButton,
  Pressable,
  Searchbar,
  Text,
  Token,
} from '@onekeyhq/components';
import { FlatListRef } from '@onekeyhq/components/src/FlatList';
import type { INetwork } from '@onekeyhq/engine/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../../../hooks';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { ManageNetworkRoutes } from '../../../../views/ManageNetworks/types';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_DELAY_NETWORK } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { AllNetwork } from '../../../Header/AccountSelectorChildren/RightChainSelector';
import { RpcStatusButton } from '../../RpcStatusButton';

import type { useAccountSelectorInfo } from '../../hooks/useAccountSelectorInfo';

function ChainNetworkIcon({
  onLastItemRender,
  item,
  isLastItem,
}: {
  onLastItemRender?: () => void;
  item: INetwork;
  isLastItem: boolean;
}) {
  useLayoutEffect(() => {
    if (isLastItem) {
      onLastItemRender?.();
    }
  }, [isLastItem, onLastItemRender]);

  return (
    <Token size={8} token={{ logoURI: item.logoURI, name: item.shortName }} />
  );
}

function SideChainSelector({
  accountSelectorInfo,
  onPress,
  fullWidthMode,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
  onPress?: (payload: { networkId: string }) => void;
  fullWidthMode?: boolean;
}) {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const navigation = useAppNavigation();
  const { serviceAccountSelector } = backgroundApiProxy;
  const { enabledNetworks } = useManageNetworks();
  const { selectedNetworkId } = accountSelectorInfo;
  const flatListRef = useRef<any>(null);

  const data = useMemo(
    () =>
      enabledNetworks.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.shortName.toLowerCase().includes(search.toLowerCase()),
      ),
    [enabledNetworks, search],
  );

  const emptyComponent = useCallback(
    () => (
      <Empty
        flex="1"
        emoji="🔍"
        title={intl.formatMessage({
          id: 'content__no_results',
          defaultMessage: 'No Result',
        })}
      />
    ),
    [intl],
  );
  const isScrolledRef = useRef(false);
  const scrollToItem = useCallback(() => {
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
    }, 0);
  }, [enabledNetworks, selectedNetworkId]);

  const scrollToItemDebounced = useMemo(
    () =>
      debounce(scrollToItem, ACCOUNT_SELECTOR_AUTO_SCROLL_DELAY_NETWORK, {
        leading: false,
        trailing: true,
      }),
    [scrollToItem],
  );
  return (
    <Box
      alignSelf="stretch"
      borderRightWidth={
        fullWidthMode || platformEnv.isNativeIOS ? 0 : StyleSheet.hairlineWidth
      }
      borderColor={fullWidthMode ? undefined : 'divider'}
      flex={fullWidthMode ? 1 : undefined}
    >
      <Box p={{ base: fullWidthMode ? 2 : 1, md: fullWidthMode ? 4 : 1 }}>
        <Searchbar
          w="full"
          value={search}
          onChangeText={(text) => setSearch(text)}
          placeholder={intl.formatMessage({ id: 'content__search' })}
          onClear={() => setSearch('')}
        />
      </Box>
      <FlatListRef
        ListEmptyComponent={emptyComponent}
        initialNumToRender={20}
        // TODO auto scroll to active item
        ref={flatListRef}
        data={data}
        contentContainerStyle={{
          flex: 1,
        }}
        keyExtractor={(item: INetwork) => item.id}
        renderItem={(options: { item: INetwork; index: number }) => {
          const { item, index } = options;
          const isLastItem = index === data.length - 1;
          const isActive = selectedNetworkId === item.id;
          return (
            <Pressable
              onPress={() => {
                const id = (item.id === AllNetwork ? '' : item.id) || '';
                serviceAccountSelector.updateSelectedNetwork(id);
                onPress?.({ networkId: id });
              }}
            >
              {({ isHovered, isPressed }) => (
                <HStack
                  alignItems="center"
                  space={3}
                  p={1.5}
                  m={fullWidthMode ? 0 : 1}
                  borderWidth={2}
                  bgColor={
                    isPressed
                      ? 'surface-pressed'
                      : isHovered
                      ? 'surface-hovered'
                      : undefined
                  }
                  borderColor={(() => {
                    if (fullWidthMode) {
                      return 'transparent';
                    }
                    return isActive ? 'interactive-default' : 'transparent';
                  })()}
                  rounded={fullWidthMode ? '12px' : 'full'}
                >
                  <ChainNetworkIcon
                    item={item}
                    isLastItem={isLastItem}
                    onLastItemRender={scrollToItemDebounced}
                  />
                  {fullWidthMode ? (
                    <>
                      <Text
                        flex={1}
                        typography="Body1Strong"
                        isTruncated
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {item.id === selectedNetworkId ? (
                        <>
                          <RpcStatusButton networkId={item.id} />
                          <Icon
                            color="interactive-default"
                            name="CheckCircleSolid"
                          />
                        </>
                      ) : null}
                    </>
                  ) : null}
                </HStack>
              )}
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
        flex={1}
        p={{ base: fullWidthMode ? 2 : 1, md: fullWidthMode ? 4 : 1 }}
        ListFooterComponent={
          fullWidthMode ? null : (
            <Box p="4px">
              <IconButton
                type="plain"
                size="xl"
                circle
                name="BarsArrowUpOutline"
                onPress={() => {
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.ManageNetwork,
                    params: { screen: ManageNetworkRoutes.Sort },
                  });
                }}
              />
            </Box>
          )
        }
      />
    </Box>
  );
}

export default SideChainSelector;
