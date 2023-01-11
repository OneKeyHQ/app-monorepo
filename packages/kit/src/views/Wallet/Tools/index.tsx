import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Box,
  Center,
  HStack,
  Icon,
  Image,
  Pressable,
  ScrollView,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import bg1 from '@onekeyhq/kit/assets/annual/tools_icon.jpg';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { HomeRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks';
import { useTools } from '../../../hooks/redux';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { openUrl } from '../../../utils/openUrl';
import { useIsVerticalOrMiddleLayout } from '../../Revoke/hooks';
import { WalletHomeTabEnum } from '../type';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ImageSourcePropType } from 'react-native';

type DataItem = {
  key: string;
  icon: ComponentProps<typeof Icon> & ImageSourcePropType;
  iconBg: ThemeToken | string | undefined;
  title: LocaleIds;
  description: LocaleIds;
  link?: string;
  tag?: LocaleIds;
};

const data: DataItem[] = [
  {
    key: 'annual',
    icon: bg1,
    iconBg: undefined,
    title: 'title__my_on_chain_journey',
    description: 'title__my_on_chain_journey_desc',
    tag: 'content__time_limit',
  },
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
  const annualReportEntryEnabled = useAppSelector(
    (s) => s.settings?.annualReportEntryEnabled ?? false,
  );
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
    if (
      !annualReportEntryEnabled ||
      !(platformEnv.isNativeAndroid || platformEnv.isNativeIOSPhone)
    ) {
      allItems = allItems.filter((n) => n.key !== 'annual');
    }
    return allItems.concat(
      tools.map((t) => ({
        key: t.title,
        icon: {
          uri: t.logoURI,
        } as any,
        iconBg: undefined,
        title: t.title,
        description: t.desc,
        link: t.link,
      })),
    );
  }, [hasAvailable, accountAddress, tools, network, annualReportEntryEnabled]);

  const handlePress = useCallback(
    (key: string) => {
      if (key === 'annual') {
        navigation.navigate(RootRoutes.Root, {
          screen: HomeRoutes.AnnualLoading,
        });
      } else if (key === 'revoke') {
        navigation.navigate(RootRoutes.Root, {
          screen: HomeRoutes.Revoke,
        });
      } else if (key === 'explorer') {
        openAddressDetails(
          accountAddress,
          intl.formatMessage({ id: 'title__blockchain_explorer' }),
        );
      } else if (key === 'pnl') {
        navigation.navigate(RootRoutes.Root, {
          screen: HomeRoutes.NFTPNLScreen,
        });
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

  const renderIcon = useCallback((icon: DataItem['icon']) => {
    if (!icon) {
      return null;
    }
    if (typeof icon === 'number') {
      return <Image borderRadius="14px" source={icon} w="full" h="full" />;
    }
    if (icon.name) {
      return <Icon {...icon} size={24} />;
    }
    return <Image borderRadius="14px" source={icon} w="full" h="full" />;
  }, []);

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
          <Box key={item.key} p="6px" width={isVertical ? '100%' : '50%'}>
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
                {renderIcon(item.icon)}
              </Center>
              <VStack ml="4" flex="1">
                <HStack alignItems="center" flex="1" pr="18px">
                  <Typography.Body1Strong
                    numberOfLines={1}
                    isTruncated
                    maxW="200px"
                  >
                    {intl.formatMessage({ id: item.title })}
                  </Typography.Body1Strong>
                  {item.tag ? (
                    <Badge
                      ml="1"
                      size="sm"
                      type="success"
                      title={intl.formatMessage({ id: item.tag })}
                    />
                  ) : null}
                </HStack>
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
