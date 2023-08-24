import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo } from 'react';

import B from 'bignumber.js';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Pressable,
  Token,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { IOverviewAccountdefisResult } from '@onekeyhq/kit-bg/src/services/ServiceOverview';
import { freezedEmptyArray } from '@onekeyhq/shared/src/consts/sharedConsts';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { FormatCurrencyNumber } from '../../components/Format';
import { useAppSelector, useNavigation } from '../../hooks';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { HomeRoutes, ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { useAssetsListLayout } from '../Wallet/AssetsList/useAssetsListLayout';
import { HomeTabAssetsHeader } from '../Wallet/HomeTabAssetsHeader';

import {
  atomHomeOverviewDefiList,
  atomHomeOverviewDefiValuesMap,
  useAtomDefiList,
  withProviderDefiList,
} from './contextOverviewDefiList';
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

export type IAccountDefiListDataFromSimpleDBOptions = {
  networkId: string;
  accountId: string;
  limitSize?: number;
  debounced?: number;
};

export function useAccountDefiListDataFromSimpleDB({
  networkId,
  accountId,
  limitSize,
  debounced = 0,
}: IAccountDefiListDataFromSimpleDBOptions) {
  const refresherTs = useAppSelector((s) => s.refresher.refreshAccountDefiTs);

  const result = usePromiseResult(
    () => {
      if (refresherTs) {
        //
      }
      const r = backgroundApiProxy.serviceOverview.buildAccountDefiList({
        networkId,
        accountId,
        limitSize,
      });
      return r;
    },
    [accountId, limitSize, networkId, refresherTs],
    {
      debounced,
      watchLoading: true,
    },
  );

  return result;
}

export function HandleRebuildDefiListData(
  options: IAccountDefiListDataFromSimpleDBOptions,
) {
  const result = useAccountDefiListDataFromSimpleDB(options);
  const [defisList, setDefiList] = useAtomDefiList(atomHomeOverviewDefiList);
  const [, setDefiValuesMap] = useAtomDefiList(atomHomeOverviewDefiValuesMap);

  useEffect(() => {
    const data = result.result;
    if (!data) {
      return;
    }
    if (data.defiValuesMap) {
      setDefiValuesMap(data.defiValuesMap);
    }
    if (data.defiKeys) {
      if (!isEqual(defisList.defiKeys, data.defiKeys)) {
        setDefiList(data);
      }
    } else {
      setDefiList(data);
    }
  }, [defisList.defiKeys, result.result, setDefiList, setDefiValuesMap]);

  return null;
}

const OverviewDefiListColumns = memo(() => {
  const intl = useIntl();
  return (
    <Box flexDirection="row" w="full">
      <Typography.Subheading color="text-subdued" flex={1}>
        {intl.formatMessage({ id: 'form__protocol_uppercase' })}
      </Typography.Subheading>
      <Typography.Subheading color="text-subdued" flex={1} textAlign="right">
        {intl.formatMessage({ id: 'form__claimable_uppercase' })}
      </Typography.Subheading>
      <Typography.Subheading color="text-subdued" flex={1} textAlign="right">
        {intl.formatMessage({ id: 'form__value_uppercase' })}
      </Typography.Subheading>
    </Box>
  );
});

OverviewDefiListColumns.displayName = 'OverviewDefiListColumns';

const AccountDefiListHeader: FC<{
  networkId: string;
  accountId: string;
  onPress?: () => void;
  extraLabel: string;
}> = ({ networkId, accountId, onPress, extraLabel }) => {
  const totalValue = useAppSelector(
    (s) =>
      s.overview.overviewStats?.[networkId]?.[accountId]?.defis?.totalValue,
  );

  const shareDefis = useAppSelector(
    (s) =>
      s.overview.overviewStats?.[networkId]?.[accountId]?.summary?.shareDefis,
  );

  const shareRate = useMemo(
    () => new B(shareDefis ?? 0).times(100),
    [shareDefis],
  );

  return (
    <HomeTabAssetsHeader
      icon="DatabaseOutline"
      title="DeFi"
      usdFiatValue={totalValue}
      shareRate={shareRate}
      extraIcon="ChevronRightMini"
      extraLabel={extraLabel}
      onPress={onPress}
      borderColor="transparent"
      columns={<OverviewDefiListColumns />}
    />
  );
};

AccountDefiListHeader.displayName = 'AccountDefiListHeader';
const AccountDefiListHeaderMemo = memo(AccountDefiListHeader);

const DefiValuesComp: FC<{ claimable: string; value: string }> = ({
  claimable,
  value,
}) => {
  const isVertical = useIsVerticalLayout();
  return (
    <>
      {isVertical ? null : (
        <Typography.Body2Strong
          flex="1"
          numberOfLines={2}
          isTruncated
          textAlign="right"
        >
          <FormatCurrencyNumber value={0} convertValue={+claimable} />
        </Typography.Body2Strong>
      )}
      <Typography.Body2Strong
        flex="1"
        textAlign="right"
        numberOfLines={2}
        isTruncated
      >
        <FormatCurrencyNumber value={0} convertValue={+value} />
      </Typography.Body2Strong>
    </>
  );
};
const DefiValuesCompMemo = memo(DefiValuesComp);

const DefiValueColumnWrapper: FC<{ valueKey: string }> = ({ valueKey }) => {
  const [map] = useAtomDefiList(atomHomeOverviewDefiValuesMap);
  return <DefiValuesCompMemo {...map[valueKey]} />;
};

const DefiValueColumnMemo = memo(DefiValueColumnWrapper);
DefiValueColumnMemo.displayName = 'DefiValueColumnMemo';

const OverviewDefiListWithoutMemo: FC<OverviewDefiListProps> = (props) => {
  const { networkId, accountId } = props;

  const [data] = useAtomDefiList(atomHomeOverviewDefiList);

  const { defis = freezedEmptyArray as IOverviewAccountdefisResult['defis'] } =
    data;
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

  const handlePressHeader = useCallback(() => {
    navigation.navigate(HomeRoutes.OverviewDefiListScreen, {
      networkId,
      accountId,
    });
  }, [navigation, networkId, accountId]);

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
      <AccountDefiListHeaderMemo
        extraLabel={defis.length.toString()}
        onPress={handlePressHeader}
        networkId={networkId}
        accountId={accountId}
      />

      {defis.map((item, idx) => (
        <Pressable.Item
          key={item._id.protocolId}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Overview,
              params: {
                screen: OverviewModalRoutes.OverviewProtocolDetail,
                params: {
                  protocol: item,
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
          <DefiValueColumnMemo
            valueKey={`${item._id.networkId}_${item._id.address}_${item._id.protocolId}`}
          />
        </Pressable.Item>
      ))}
    </VStack>
  );
};

const OverviewDefiListMemo = memo(OverviewDefiListWithoutMemo);
OverviewDefiListMemo.displayName = 'OverviewDefiList';

const OverviewDefiListView: FC<OverviewDefiListProps> = (props) => (
  <>
    <OverviewDefiListMemo {...props} />
    <HandleRebuildDefiListData {...props} debounced={600} />
  </>
);

export const OverviewDefiList = memo(
  withProviderDefiList(OverviewDefiListView),
);
