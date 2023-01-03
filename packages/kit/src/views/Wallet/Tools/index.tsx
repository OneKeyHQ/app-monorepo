import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Center,
  Icon,
  Pressable,
  ScrollView,
  Token,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
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
  iconBg: ThemeToken | string | undefined;
  title: LocaleIds;
  description: LocaleIds;
  link?: string;
};

const data: DataItem[] = [
  {
    key: 'revoke',
    icon: {
      name: 'ShieldCheckSolid',
      color: 'decorative-icon-one',
    },
    iconBg: 'decorative-surface-one',
    title: 'title__contract_approvals',
    description: 'title__token_approvals_desc',
  },
  {
    key: 'explorer',
    icon: {
      name: 'GlobeAltSolid',
      color: 'decorative-icon-two',
    },
    iconBg: 'decorative-surface-two',
    title: 'title__blockchain_explorer',
    description: 'title__blockchain_explorer_desc',
  },
  {
    key: 'pnl',
    icon: {
      name: 'DocumentChartBarSolid',
      color: 'decorative-icon-four',
    },
    iconBg: 'decorative-surface-four',
    title: 'content__nft_profit_and_loss',
    description: 'empty__pnl',
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
        iconBg: undefined,
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
      } else if (key === 'pnl') {
        navigation.navigate(HomeRoutes.NFTPNLScreen);
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
      contentContainerStyle={{
        marginVertical: 24,
        paddingHorizontal: responsivePadding,
        flexDirection: 'row',
      }}
    >
      <Box
        m="-6px"
        flexDirection={isVertical ? 'column' : 'row'}
        flex={1}
        flexWrap="wrap"
      >
        {items.map((item) => (
          <Box p="6px" width={isVertical ? '100%' : '50%'}>
            <Pressable
              flexDirection="row"
              p="16px"
              bg="surface-default"
              _hover={{ bg: 'surface-hovered' }}
              _pressed={{ bg: 'surface-pressed' }}
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="border-default"
              borderRadius="12px"
              key={item.title}
              onPress={() => {
                handlePress(item.key);
              }}
            >
              <Center
                w="48px"
                h="48px"
                bgColor={item.iconBg}
                borderRadius="12px"
              >
                {typeof item.icon === 'string' ? (
                  <Token token={{ logoURI: item.icon }} size={8} />
                ) : (
                  <Icon {...item.icon} size={24} />
                )}
              </Center>
              <VStack ml="4" flex="1">
                <Typography.Body1Strong numberOfLines={1} isTruncated>
                  {intl.formatMessage({ id: item.title })}
                </Typography.Body1Strong>
                <Typography.Body2
                  mt="4px"
                  numberOfLines={2}
                  isTruncated
                  color="text-subdued"
                >
                  {intl.formatMessage({ id: item.description })}
                </Typography.Body2>
              </VStack>
            </Pressable>
          </Box>
        ))}
      </Box>
    </ScrollView>
  );
};

export default ToolsPage;
