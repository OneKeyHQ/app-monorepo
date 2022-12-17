import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Center,
  HStack,
  Icon,
  Pressable,
  ScrollView,
  Token,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import type {
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

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
    if (network?.impl !== IMPL_EVM) {
      allItems = allItems.filter((n) => n.key !== 'revoke');
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
  }, [hasAvailable, accountAddress, tools, network]);

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

  return (
    <ScrollView
      px={isVertical ? 4 : 0}
      contentContainerStyle={{
        marginTop: 32,
        paddingHorizontal: responsivePadding,
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}
    >
      {items.map((item, index) => (
        <Pressable
          width={isVertical ? '100%' : '50%'}
          key={item.title}
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
      ))}
    </ScrollView>
  );
};

export default ToolsPage;
