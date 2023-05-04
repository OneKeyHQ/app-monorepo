/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable no-nested-ternary */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { debounce, pick } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  HStack,
  Icon,
  KeyboardAvoidingView,
  Pressable,
  RichTooltip,
  Searchbar,
  Text,
  Token,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { FlatListRef } from '@onekeyhq/components/src/FlatList';
import type { INetwork } from '@onekeyhq/engine/src/types';
import { WALLET_TYPE_HW } from '@onekeyhq/engine/src/types/wallet';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../../../hooks';
import {
  NetworkListEmpty,
  strIncludes,
} from '../../../../views/ManageNetworks/Listing/NetworkListEmpty';
import { ACCOUNT_SELECTOR_AUTO_SCROLL_DELAY_NETWORK } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { AllNetwork } from '../../../Header/AccountSelectorChildren/RightChainSelector';
import { RpcStatusButton } from '../../RpcStatusButton';

import { NetWorkDisabledInfo } from './NetworkDisabledInfo';

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
  networkImpl,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
  onPress?: (payload: { networkId: string }) => void;
  fullWidthMode?: boolean;
  networkImpl?: string;
}) {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const { serviceAccountSelector } = backgroundApiProxy;
  const { enabledNetworks } = useManageNetworks();
  const { selectedNetworkId, activeWallet } = accountSelectorInfo;
  const flatListRef = useRef<any>(null);

  const data = useMemo(
    () =>
      enabledNetworks.filter((d: INetwork) => {
        if (networkImpl && d.impl !== networkImpl) {
          return false;
        }
        for (const v of Object.values(
          pick(d, 'name', 'shortName', 'id', 'symbol'),
        )) {
          if (strIncludes(String(v), search)) {
            return true;
          }
        }
        return false;
      }),
    [networkImpl, enabledNetworks, search],
  );

  const isScrolledRef = useRef(false);
  const isScrollToIndexRetried = useRef(false);
  const scrollToItem = useCallback(
    ({ isRetry }: { isRetry?: boolean } = {}) => {
      if (
        isScrolledRef.current ||
        !enabledNetworks ||
        !enabledNetworks.length ||
        !selectedNetworkId
      ) {
        return;
      }
      if (isRetry && isScrollToIndexRetried.current) {
        return;
      }
      if (isRetry) {
        isScrollToIndexRetried.current = true;
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
          flatListRef?.current?.scrollToIndex?.({ animated: false, index });
          isScrolledRef.current = true;
        } catch (error) {
          debugLogger.common.error(error);
        }
      }, 0);
    },
    [enabledNetworks, selectedNetworkId],
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const scrollToItemDebounced = useMemo(
    () =>
      debounce(scrollToItem, ACCOUNT_SELECTOR_AUTO_SCROLL_DELAY_NETWORK, {
        leading: false,
        trailing: true,
      }),
    [scrollToItem],
  );

  const renderItem = useCallback(
    (options: { item: INetwork; index: number }) => {
      const { item, index } = options;
      const isLastItem = index === data.length - 1;
      const isActive = selectedNetworkId === item.id;
      const isDisabled =
        activeWallet?.type === WALLET_TYPE_HW &&
        !item.settings.hardwareAccountEnabled;
      return (
        <HStack alignItems="center">
          <Pressable
            _disabled={{ opacity: 0.5 }}
            disabled={isDisabled}
            onPress={() => {
              const id = (item.id === AllNetwork ? '' : item.id) || '';
              serviceAccountSelector.updateSelectedNetwork(id);
              onPress?.({ networkId: id });
            }}
            flex={1}
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
                  onLastItemRender={() => scrollToItem({ isRetry: false })}
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
                    {item.id === selectedNetworkId && !isDisabled ? (
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
          {fullWidthMode && isDisabled && (
            <RichTooltip
              // eslint-disable-next-line react/no-unstable-nested-components
              trigger={({ ...props }) => (
                <Pressable {...props}>
                  <Icon
                    name="InformationCircleOutline"
                    size={18}
                    color="icon-subdued"
                  />
                </Pressable>
              )}
              bodyProps={{
                children: <NetWorkDisabledInfo networkId={item.id} />,
              }}
            />
          )}
        </HStack>
      );
    },
    [
      data.length,
      selectedNetworkId,
      activeWallet?.type,
      fullWidthMode,
      serviceAccountSelector,
      onPress,
      scrollToItem,
    ],
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
      {fullWidthMode ? (
        <Box p={{ base: 4, md: 6 }} pb={2}>
          <Searchbar
            w="full"
            value={search}
            onChangeText={(text) => setSearch(text)}
            placeholder={intl.formatMessage({ id: 'content__search' })}
            onClear={() => setSearch('')}
          />
        </Box>
      ) : null}
      <KeyboardAvoidingView flex={1}>
        <FlatListRef
          onScrollToIndexFailed={() => scrollToItem({ isRetry: true })}
          ListEmptyComponent={NetworkListEmpty}
          initialNumToRender={20}
          // TODO auto scroll to active item
          ref={flatListRef}
          data={data}
          contentContainerStyle={{
            flex: data?.length ? undefined : 1,
            paddingBottom: bottom,
          }}
          keyExtractor={(item: INetwork) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          p={{ base: fullWidthMode ? 2 : 1, md: fullWidthMode ? 4 : 1 }}
          pt={0}
        />
      </KeyboardAvoidingView>
    </Box>
  );
}

export default SideChainSelector;
