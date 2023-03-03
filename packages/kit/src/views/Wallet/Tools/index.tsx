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
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
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
    key: 'bulkSender',
    icon: {
      name: 'BulkSenderMini',
      color: 'decorative-icon-two',
    },
    iconBg: 'decorative-surface-two',
    title: 'title__bulksender',
    description: 'title__bulksender_desc',
  },
  {
    key: 'explorer',
    icon: {
      name: 'GlobeAltSolid',
      color: 'decorative-icon-three',
    },
    iconBg: 'decorative-surface-three',
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
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.NFTPNLScreen> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.Revoke>;

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

  const responsivePadding = useMemo(() => {
    if (['NORMAL', 'LARGE'].includes(size)) return 32;
    return 16;
  }, [size]);

  const { openAddressDetails, hasAvailable } = useOpenBlockBrowser(network);

  const items = useMemo(() => {
    let allItems = data;
    if (!hasAvailable || !accountAddress) {
      allItems = data.filter((d) => d.key !== 'explorer');
    }
    if (network?.impl !== IMPL_EVM) {
      allItems = allItems.filter((n) => n.key !== 'revoke' && n.key !== 'pnl');
    }
    if (
      !annualReportEntryEnabled ||
      !(platformEnv.isNativeAndroid || platformEnv.isNativeIOSPhone)
    ) {
      allItems = allItems.filter((n) => n.key !== 'annual');
    }

    if (
      !network?.settings.supportBatchTransfer ||
      (network.impl === IMPL_EVM && !batchTransferContractAddress[network.id])
    ) {
      allItems = allItems.filter((n) => n.key !== 'bulkSender');
    }

    if (
      network?.impl === IMPL_EVM &&
      !batchTransferContractAddress[network?.id]
    ) {
      allItems = allItems.filter((n) => n.key !== 'bulkSender');
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
  }, [
    hasAvailable,
    accountAddress,
    network?.impl,
    network?.settings.supportBatchTransfer,
    network?.id,
    annualReportEntryEnabled,
    tools,
  ]);

  const params = useMemo(
    () => ({
      address: accountAddress,
      networkId: network?.id,
    }),
    [accountAddress, network],
  );

  const handlePress = useCallback(
    (key: string) => {
      if (key === 'annual') {
        navigation.navigate(RootRoutes.Root, {
          screen: HomeRoutes.AnnualLoading,
        });
      } else if (key === 'revoke') {
        navigation.navigate(HomeRoutes.Revoke);
      } else if (key === 'explorer') {
        openAddressDetails(
          accountAddress,
          intl.formatMessage({ id: 'title__blockchain_explorer' }),
        );
      } else if (key === 'pnl') {
        navigation.navigate(HomeRoutes.NFTPNLScreen);
      } else if (key === 'bulkSender') {
        if (platformEnv.isExtFirefoxUiPopup) {
          backgroundApiProxy.serviceApp.openExtensionExpandTab({
            routes: [RootRoutes.Root, HomeRoutes.BulkSender],
          });
          setTimeout(() => {
            window.close();
          }, 300);
        } else {
          navigation.navigate(HomeRoutes.BulkSender);
        }
      } else {
        const item = tools?.find((t) => t.title === key);
        if (item) {
          // inject params
          const url = item?.link?.replace(
            /\{([\w\d]+)\}/g,
            (_, name: keyof typeof params) => params[name] ?? '',
          );
          openUrl(url, item?.title, {
            modalMode: true,
          });
        }
      }
    },
    [tools, navigation, openAddressDetails, accountAddress, intl, params],
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
    <Tabs.FlatList
      key={String(isVertical)}
      data={items}
      keyExtractor={(_item) => _item.key}
      numColumns={isVertical ? undefined : 2}
      contentContainerStyle={{
        marginVertical: 24,
        paddingHorizontal: responsivePadding,
      }}
      renderItem={({ item }) => (
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
            alignItems="center"
            key={item.title}
            onPress={() => {
              handlePress(item.key);
            }}
          >
            <Center w="48px" h="48px" bgColor={item.iconBg} borderRadius="12px">
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
      )}
    />
  );
};

export default ToolsPage;
