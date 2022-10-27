import React, { ComponentProps, FC, useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Center,
  FlatList,
  HStack,
  Icon,
  Pressable,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  HomeRoutes,
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import { useActiveWalletAccount } from '../../../hooks';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type DataItem = {
  key: string;
  icon: ComponentProps<typeof Icon>;
  title: LocaleIds;
  description: LocaleIds;
};

const data: DataItem[] = [
  {
    key: 'revoke',
    icon: {
      name: 'ShieldExclamationSolid',
      color: 'icon-success',
      size: 32,
    },
    title: 'title__contract_approvals',
    description: 'title__token_approvals_desc',
  },
  {
    key: 'explorer',
    icon: {
      name: 'BlockExplorerSolid',
      color: 'icon-success',
      size: 32,
    },
    title: 'title__blockchain_explorer',
    description: 'title__blockchain_explorer_desc',
  },
];

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const ToolsPage: FC = () => {
  const intl = useIntl();
  const { network, accountAddress } = useActiveWalletAccount();
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const { openAddressDetails, hasAvailable } = useOpenBlockBrowser(network);

  const items = useMemo(() => {
    if (!hasAvailable || !accountAddress) {
      return data.filter((d) => d.key !== 'explorer');
    }
    return data;
  }, [hasAvailable, accountAddress]);

  const handlePress = useCallback(
    (key: string) => {
      if (key === 'revoke') {
        navigation.navigate(HomeRoutes.Revoke);
      } else if (key === 'explorer') {
        openAddressDetails(
          accountAddress,
          intl.formatMessage({ id: 'title__blockchain_explorer' }),
        );
      }
    },
    [navigation, openAddressDetails, accountAddress, intl],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: typeof data[0]; index: number }) => (
      <Pressable
        flex={1 / 2}
        mb="4"
        onPress={() => {
          handlePress(item.key);
        }}
        pl={!isVertical && index % 2 === 1 ? 4 : 0}
      >
        <HStack
          bg="surface-default"
          borderWidth={1}
          borderColor="divider"
          borderRadius="12px"
          px="3"
          h="80px"
          alignItems="center"
        >
          <Center w="8" h="8">
            <Icon {...item.icon} size={32} />
          </Center>
          <VStack ml="4" flex="1">
            <Typography.Body1Strong numberOfLines={1} isTruncated>
              {intl.formatMessage({ id: item.title })}
            </Typography.Body1Strong>
            <Typography.Caption numberOfLines={2} isTruncated>
              {intl.formatMessage({ id: item.description })}
            </Typography.Caption>
          </VStack>
        </HStack>
      </Pressable>
    ),
    [intl, handlePress, isVertical],
  );

  const container = useMemo(
    () => (
      <FlatList
        px={isVertical ? 4 : 0}
        key={String(isVertical)}
        contentContainerStyle={{
          marginTop: 32,
        }}
        numColumns={isVertical ? undefined : 2}
        showsHorizontalScrollIndicator={false}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.title}
      />
    ),
    [isVertical, renderItem, items],
  );

  return container;
};

export default ToolsPage;
