import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { groupBy } from 'lodash';
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
import {
  isAllNetworks,
  parseNetworkId,
} from '@onekeyhq/engine/src/managers/network';
import { revokeUrl } from '@onekeyhq/engine/src/managers/revoke';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import btcSetting from '@onekeyhq/engine/src/vaults/impl/btc/settings';
import tbtcSetting from '@onekeyhq/engine/src/vaults/impl/tbtc/settings';
import {
  HomeRoutes,
  InscribeModalRoutes,
  MainRoutes,
  ModalRoutes,
  RootRoutes,
  TabRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks';
import {
  getManageNetworks,
  useManageNetworks,
} from '../../../hooks/crossHooks';
import { useTools } from '../../../hooks/redux';
import {
  useAllNetworksSelectNetworkAccount,
  useAllNetworksWalletAccounts,
} from '../../../hooks/useAllNetwoks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { buildAddressDetailsUrl } from '../../../hooks/useOpenBlockBrowser';
import { openDapp, openUrl } from '../../../utils/openUrl';
import { useIsVerticalOrMiddleLayout } from '../../Revoke/hooks';

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
  filter?: (params: {
    network?: Network | null;
    account?: Account | null;
  }) => boolean;
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
    filter: ({ network }) => network?.impl === IMPL_EVM,
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
    filter: ({ network, account }) =>
      !!(
        !!account &&
        !account?.id.startsWith('watching-') &&
        network?.settings?.supportBatchTransfer &&
        network?.settings?.supportBatchTransfer.length > 0
      ),
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
    filter: ({ network, account }) =>
      !!getManageNetworks(undefined).allNetworks?.find?.(
        (n) => n.id === network?.id,
      )?.blockExplorerURL?.address && !!account?.address,
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
    filter: ({ network }) => network?.impl === IMPL_EVM,
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
    filter: ({ network, account }) =>
      [IMPL_BTC, IMPL_TBTC].includes(network?.impl ?? '') &&
      !!account?.template &&
      [
        tbtcSetting.accountNameInfo?.BIP86?.template,
        btcSetting.accountNameInfo?.BIP86?.template,
      ].includes(account?.template),
  },
];

const ToolsPage: FC = () => {
  const intl = useIntl();
  const { network, account, accountId, networkId } = useActiveWalletAccount();
  const isVertical = useIsVerticalOrMiddleLayout();
  const navigation = useNavigation();
  const { enabledNetworks } = useManageNetworks(undefined);

  const appNavigation = useAppNavigation();
  const tools = useTools(network?.id);

  const networkAccountsMap = useAllNetworksWalletAccounts({
    accountId,
  });

  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    networkId,
    accountId,
  });

  const items = useMemo(() => {
    let allItems = data;
    allItems = allItems.concat(
      Object.values(groupBy(tools, 'title'))
        .filter((ts) => ts.length > 0)
        .map((ts) => {
          const t = ts[0];
          return {
            ts,
            key: t.title,
            icon: {
              uri: t.logoURI,
            } as any,
            iconBg: undefined,
            title: t.title,
            description: t.desc,
            link: t.link,
            intlDisabled: true,
            filter: ({ network: n }) => ts.some((i) => i.networkId === n?.id),
          };
        }),
    );
    if (!isAllNetworks(network?.id)) {
      return allItems.filter((n) => n.filter?.({ network, account }) ?? true);
    }
    return allItems.filter((item) => {
      for (const [nid, accounts] of Object.entries(networkAccountsMap ?? {})) {
        const n = enabledNetworks.find((i) => i.id === nid);
        if (n) {
          for (const a of accounts) {
            if (!item.filter || item.filter({ network: n, account: a })) {
              return true;
            }
          }
        }
      }
      return false;
    });
  }, [account, network, tools, networkAccountsMap, enabledNetworks]);

  const handlePress = useCallback(
    ({
      key,
      network: selectedNetwork,
      account: selectedAccount,
    }: {
      key: string;
      network?: Network | null;
      account?: Account | null;
    }) => {
      if (key === 'revoke') {
        const { chainId } = parseNetworkId(network?.id ?? '');
        openDapp(
          `${revokeUrl}address/${selectedAccount?.address ?? ''}?chainId=${
            chainId ?? ''
          }`,
        );
      } else if (key === 'explorer') {
        const url = buildAddressDetailsUrl(
          selectedNetwork,
          selectedAccount?.address,
        );
        openUrl(url, intl.formatMessage({ id: 'title__blockchain_explorer' }), {
          modalMode: true,
        });
      } else if (key === 'pnl') {
        navigation.navigate(RootRoutes.Main, {
          screen: MainRoutes.Tab,
          params: {
            screen: TabRoutes.Home,
            params: {
              screen: HomeRoutes.NFTPNLScreen,
            },
          },
        });
      } else if (key === 'bulkSender') {
        if (platformEnv.isExtFirefoxUiPopup) {
          backgroundApiProxy.serviceApp.openExtensionExpandTab({
            routes: [RootRoutes.Main, HomeRoutes.BulkSender],
          });
          setTimeout(() => {
            window.close();
          }, 300);
        } else {
          navigation.navigate(RootRoutes.Main, {
            screen: MainRoutes.Tab,
            params: {
              screen: TabRoutes.Home,
              params: {
                screen: HomeRoutes.BulkSender,
              },
            },
          });
        }
      } else if (key === 'inscribe') {
        if (selectedNetwork?.id && selectedAccount) {
          appNavigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Inscribe,
            params: {
              screen: InscribeModalRoutes.InscribeModal,
              params: {
                networkId: selectedNetwork?.id,
                accountId: selectedAccount?.id,
              },
            },
          });
        }
      } else {
        const item = tools?.find((t) => t.title === key);
        const params = {
          address: selectedAccount?.address ?? '',
          networkId: selectedNetwork?.id,
        };
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
    [network?.id, tools, navigation, intl, appNavigation],
  );

  const onItemPress = useCallback(
    (key: string) => {
      if (!isAllNetworks(network?.id)) {
        return handlePress({
          key,
          network,
          account,
        });
      }
      const item = items.find((n) => n.key === key);
      if (!item) {
        return;
      }
      selectNetworkAccount(item.filter).then(
        async ({ network: selectedNetwork, account: selectedAccount }) => {
          if (key === 'bulkSender' || key === 'pnl') {
            const { serviceNetwork, serviceAccount } = backgroundApiProxy;
            await serviceNetwork.changeActiveNetwork(selectedNetwork?.id);
            await serviceAccount.changeActiveAccountByAccountId(
              selectedAccount?.id,
            );
          }
          handlePress({
            key,
            network: selectedNetwork,
            account: selectedAccount,
          });
        },
      );
    },
    [handlePress, network, account, items, selectNetworkAccount],
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
              onItemPress(item.key);
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
