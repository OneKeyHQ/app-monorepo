import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import {
  HomeRoutes,
  InscribeModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks';
import { useTools } from '../../../hooks/redux';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { openUrl } from '../../../utils/openUrl';
import { useIsVerticalOrMiddleLayout } from '../../Revoke/hooks';

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
  intlDisabled?: boolean;
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
  {
    key: 'inscribe',
    icon: {
      name: 'SparklesSolid',
      color: 'decorative-icon-one',
    },
    iconBg: 'decorative-surface-one',
    title: 'title__inscribe',
    description: 'title__inscribe_desc',
  },
];

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.NFTPNLScreen> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.Revoke>;

const ToolsPage: FC = () => {
  const intl = useIntl();
  const { network, accountAddress, accountId, networkId } =
    useActiveWalletAccount();
  const isVertical = useIsVerticalOrMiddleLayout();
  const navigation = useNavigation<NavigationProps>();
  const appNavigation = useAppNavigation();
  const [inscribeEnable, setInscribeEnable] = useState(false);
  const tools = useTools(network?.id);
  const { serviceInscribe } = backgroundApiProxy;
  const { openAddressDetails, hasAvailable } = useOpenBlockBrowser(network);

  useEffect(() => {
    if (accountAddress?.length > 0) {
      serviceInscribe
        .checkValidTaprootAddress({ address: accountAddress })
        .then((result) => setInscribeEnable(result))
        .catch(() => setInscribeEnable(false));
    }
  }, [accountAddress, networkId, serviceInscribe]);

  const items = useMemo(() => {
    let allItems = data;
    if (!hasAvailable || !accountAddress) {
      allItems = data.filter((d) => d.key !== 'explorer');
    }
    if (network?.impl !== IMPL_EVM) {
      allItems = allItems.filter((n) => n.key !== 'revoke' && n.key !== 'pnl');
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

    if (!inscribeEnable) {
      allItems = allItems.filter((n) => n.key !== 'inscribe');
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
        intlDisabled: true,
      })),
    );
  }, [
    hasAvailable,
    accountAddress,
    network?.impl,
    network?.settings.supportBatchTransfer,
    network?.id,
    inscribeEnable,
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
      if (key === 'revoke') {
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
            routes: [RootRoutes.Main, HomeRoutes.BulkSender],
          });
          setTimeout(() => {
            window.close();
          }, 300);
        } else {
          navigation.navigate(HomeRoutes.BulkSender);
        }
      } else if (key === 'inscribe') {
        if (network?.id) {
          appNavigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Inscribe,
            params: {
              screen: InscribeModalRoutes.InscribeModal,
              params: { networkId: network?.id, accountId },
            },
          });
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
    [
      navigation,
      openAddressDetails,
      accountAddress,
      intl,
      network?.id,
      appNavigation,
      accountId,
      tools,
      params,
    ],
  );

  const getItemPaddingx = useCallback(
    (index: number) => {
      if (isVertical) {
        return {
          paddingLeft: 0,
          paddingRight: 0,
        };
      }
      return {
        paddingLeft: index % 2 === 0 ? 0 : 6,
        paddingRight: index % 2 === 1 ? 0 : 6,
      };
    },
    [isVertical],
  );

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

  useEffect(() => {
    backgroundApiProxy.serviceToken.fetchTools();
  }, []);

  return (
    <Tabs.FlatList
      key={String(isVertical)}
      data={items}
      keyExtractor={(_item) => _item.key}
      numColumns={isVertical ? undefined : 2}
      contentContainerStyle={{
        marginVertical: 24,
        paddingHorizontal: isVertical ? 32 : 16,
      }}
      renderItem={({ item, index }) => (
        <Box
          key={item.key}
          p="6px"
          width={isVertical ? '100%' : '50%'}
          style={getItemPaddingx(index)}
        >
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
                  {item.intlDisabled
                    ? item.title
                    : intl.formatMessage({ id: item.title })}
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
                {item.intlDisabled
                  ? item.description
                  : intl.formatMessage({ id: item.description })}
              </Typography.Body2>
            </VStack>
          </Pressable>
        </Box>
      )}
    />
  );
};

export default ToolsPage;
