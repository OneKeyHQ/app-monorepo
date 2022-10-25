import React, { FC, useCallback, useMemo } from 'react';

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
import {
  HomeRoutes,
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const data = [
  {
    key: 'revoke',
    icon: {
      name: 'ShieldExclamationSolid',
      color: 'icon-success',
      size: 32,
    },
    title: 'title__token_approvals',
    description: 'title__token_approvals_desc',
  },
] as const;

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const ToolsPage: FC = () => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();

  const handlePress = useCallback(
    (key: string) => {
      if (key === 'revoke') {
        navigation.navigate(HomeRoutes.Revoke);
      }
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: typeof data[0] }) => (
      <Pressable
        flex={1 / 2}
        h="80px"
        mb="4"
        onPress={() => {
          handlePress(item.key);
        }}
      >
        <HStack
          bg="surface-subdued"
          borderWidth={1}
          borderColor="border-subdued"
          borderRadius="12px"
          px="3"
          py="18px"
          flex="1"
        >
          <Center w="8" h="8">
            <Icon {...item.icon} />
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
    [intl, handlePress],
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
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.title}
      />
    ),
    [isVertical, renderItem],
  );

  return container;
};

export default ToolsPage;
