import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo } from 'react';

import B from 'bignumber.js';

import {
  Pressable,
  Token,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { FormatCurrencyNumber } from '../../components/Format';
import {
  useAccountPortfolios,
  useAccountValues,
  useNavigation,
} from '../../hooks';
import { HomeRoutes, ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { useAssetsListLayout } from '../Wallet/AssetsList/useAssetsListLayout';
import { HomeTabAssetsHeader } from '../Wallet/HomeTabAssetsHeader';

import { EOverviewScanTaskType, OverviewModalRoutes } from './types';

import type { HomeRoutesParams, RootRoutesParams } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
> &
  NativeStackNavigationProp<
    HomeRoutesParams,
    HomeRoutes.OverviewDefiListScreen
  >;

export type OverviewDefiListProps = {
  networkId: string;
  accountId: string;
  limitSize?: number;
};

export type IAssetHeaderProps = {
  name: string;
  value: B;
  itemLength: number;
  accountAllValue: B;
  onPress: () => void;
};
const OverviewDefiListWithoutMemo: FC<OverviewDefiListProps> = (props) => {
  const { networkId, limitSize, accountId } = props;
  const { data: defis } = useAccountPortfolios({
    networkId,
    accountId,
    type: EOverviewScanTaskType.defi,
  });
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const { containerPaddingX } = useAssetsListLayout();

  // fetch defi on mount or network/account changed
  useEffect(() => {
    if (networkId && !isAllNetworks(networkId) && accountId) {
      backgroundApiProxy.serviceOverview.fetchAccountOverviewDebounced({
        networkId,
        accountId,
        scanTypes: [EOverviewScanTaskType.defi],
      });
    }
  }, [networkId, accountId]);

  const allDefiValues = useMemo(
    () => defis.reduce((sum, next) => sum.plus(next.protocolValue), new B(0)),
    [defis],
  );

  const accountAllValue = useAccountValues({
    networkId,
    accountId,
  }).value;

  const handlePressHeader = useCallback(() => {
    navigation.navigate(HomeRoutes.OverviewDefiListScreen, {
      networkId,
      accountId,
    });
  }, [navigation, networkId, accountId]);

  const rate = useMemo(
    () => allDefiValues.div(accountAllValue).multipliedBy(100),
    [allDefiValues, accountAllValue],
  );

  if (!defis.length) {
    return null;
  }

  return (
    <VStack
      overflow="hidden"
      borderColor="border-subdued"
      borderWidth="1px"
      borderRadius={12}
      mb="24"
      mx={containerPaddingX.px}
    >
      <HomeTabAssetsHeader
        icon="DatabaseOutline"
        title="DeFi"
        usdFiatValue={allDefiValues.toFixed()}
        shareRate={rate}
        extraIcon="ChevronRightMini"
        extraLabel={defis.length.toString()}
        onPress={handlePressHeader}
        borderColor="transparent"
      />

      {defis.slice(0, limitSize).map((item, idx) => (
        <Pressable.Item
          key={item._id.protocolId}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Overview,
              params: {
                screen: OverviewModalRoutes.OverviewProtocolDetail,
                params: {
                  protocolId: item._id.protocolId,
                  networkId,
                  accountId,
                },
              },
            });
          }}
          flex={1}
          px="6"
          py="4"
          flexDirection="row"
          alignItems="center"
          borderTopWidth={idx === 0 ? 0 : '1px'}
          borderTopColor="divider"
        >
          <Token
            flex="1"
            size={8}
            showInfo
            infoBoxProps={{ flex: 1 }}
            token={{
              logoURI: item.protocolIcon,
              networkId: item._id.networkId,
              name: item.protocolName,
            }}
            showNetworkIcon
          />
          {isVertical ? null : (
            <Typography.Body2Strong
              flex="1"
              numberOfLines={2}
              isTruncated
              textAlign="right"
            >
              <FormatCurrencyNumber
                value={0}
                convertValue={+item.claimableValue}
              />
            </Typography.Body2Strong>
          )}
          <Typography.Body2Strong
            flex="1"
            textAlign="right"
            numberOfLines={2}
            isTruncated
          >
            <FormatCurrencyNumber
              value={0}
              convertValue={+item.protocolValue}
            />
          </Typography.Body2Strong>
        </Pressable.Item>
      ))}
    </VStack>
  );
};

export const OverviewDefiList = memo(OverviewDefiListWithoutMemo);
OverviewDefiList.displayName = 'OverviewDefiList';
