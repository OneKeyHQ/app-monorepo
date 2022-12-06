import React, {
  ComponentProps,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Center,
  FlatList,
  HStack,
  Icon,
  Pressable,
  Token,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  HomeRoutes,
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks';
import { useTools } from '../../../hooks/redux';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { openUrl } from '../../../utils/openUrl';
import { useIsVerticalOrMiddleLayout } from '../../Revoke/hooks';
import { WalletHomeTabEnum } from '../type';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type DataItem = {
  key: string;
  icon: ComponentProps<typeof Icon> | string;
  title: LocaleIds;
  description: LocaleIds;
  link?: string;
};

const data: DataItem[] = [
  {
    key: 'revoke',
    icon: {
      name: 'ShieldCheckMini',
      color: 'icon-success',
      size: 32,
    },
    title: 'title__contract_approvals',
    description: 'title__token_approvals_desc',
  },
  {
    key: 'explorer',
    icon: {
      name: 'BlockExplorerMini',
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
  const hasFetchedRef = useRef(false);
  const { size } = useUserDevice();
  const { network, accountAddress } = useActiveWalletAccount();
  const isVertical = useIsVerticalOrMiddleLayout();
  const navigation = useNavigation<NavigationProps>();
  const homeTabName = useAppSelector((s) => s.status.homeTabName);
  const tools = useTools(network?.id);

  const { openAddressDetails, hasAvailable } = useOpenBlockBrowser(network);

  const responsivePadding = useMemo(() => {
    if (['NORMAL', 'LARGE'].includes(size)) return 32;
    return 16;
  }, [size]);

  const items = useMemo(() => {
    let allItems = data;
    if (!hasAvailable || !accountAddress) {
      allItems = data.filter((d) => d.key !== 'explorer');
    }
    return allItems.concat(
      tools.map((t) => ({
        key: t.title,
        icon: t.logoURI,
        title: t.title,
        description: t.desc,
        link: t.link,
      })),
    );
  }, [hasAvailable, accountAddress, tools]);

  const handlePress = useCallback(
    (key: string) => {
      if (key === 'revoke') {
        navigation.navigate(HomeRoutes.Revoke);
      } else if (key === 'explorer') {
        openAddressDetails(
          accountAddress,
          intl.formatMessage({ id: 'title__blockchain_explorer' }),
        );
      } else {
        const item = tools?.find((t) => t.title === key);
        if (item) {
          openUrl(item?.link, item?.title, {
            modalMode: true,
          });
        }
      }
    },
    [tools, navigation, openAddressDetails, accountAddress, intl],
  );

  const fetchData = useCallback(() => {
    backgroundApiProxy.serviceToken.fetchTools().finally(() => {
      hasFetchedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) {
      return;
    }
    if (homeTabName !== WalletHomeTabEnum.Tools) {
      return;
    }
    fetchData();
  }, [fetchData, homeTabName]);

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
            {typeof item.icon === 'string' ? (
              <Token token={{ logoURI: item.icon }} size={8} />
            ) : (
              <Icon {...item.icon} size={32} />
            )}
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
          paddingHorizontal: responsivePadding,
        }}
        numColumns={isVertical ? undefined : 2}
        showsHorizontalScrollIndicator={false}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.title}
      />
    ),
    [isVertical, renderItem, items, responsivePadding],
  );

  return container;
};

export default ToolsPage;
