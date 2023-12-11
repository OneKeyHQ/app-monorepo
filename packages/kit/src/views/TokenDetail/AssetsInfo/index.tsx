import type { FC } from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';

import B from 'bignumber.js';
import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Empty,
  HStack,
  Icon,
  Image,
  ListItem,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { FAKE_ALL_NETWORK } from '@onekeyhq/shared/src/config/fakeNetwork';
import { freezedEmptyObject } from '@onekeyhq/shared/src/consts/sharedConsts';

import dappColourPNG from '../../../../assets/dapp_colour.png';
import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { useAccount, useManageNetworks } from '../../../hooks';
import { TokenDetailContext } from '../context';

import type { IOverviewTokenDetailListItem } from '../../Overview/types';
import type { ITokenDetailContext } from '../context';
import type { ListRenderItem } from 'react-native';

const Header: FC<{
  networks: ({ id: string; name?: string; logoURI: string } | undefined)[];
  onChange: (id: string) => void;
  value?: string;
}> = ({ networks, onChange, value }) => {
  const data = [
    Object.assign(FAKE_ALL_NETWORK, {
      name: 'All',
    }),
    ...networks,
  ].filter(Boolean);
  const index = useMemo(
    () => data.findIndex((n) => n?.id === value),
    [data, value],
  );
  const onPress = useCallback(
    (i: number) => {
      const item = data[i];
      onChange(item?.id ?? '');
    },
    [data, onChange],
  );
  if (networks.length <= 1) {
    return null;
  }
  return (
    <ToggleButtonGroup
      mt="6"
      size="sm"
      buttons={data.filter(Boolean).map((item) => ({
        text: item.name ?? '',
        id: item.id,
        // eslint-disable-next-line
        leftComponentRender: () => (
          <Box mr="1">
            <Image
              width="20px"
              height="20px"
              borderRadius="full"
              source={
                isAllNetworks(item.id)
                  ? dappColourPNG
                  : {
                      uri: item.logoURI,
                    }
              }
            />
          </Box>
        ),
      }))}
      selectedIndex={index}
      onButtonPress={onPress}
      bg="background-default"
    />
  );
};

const AssetsInfo: FC = () => {
  const { allNetworks } = useManageNetworks(undefined);
  const context = useContext(TokenDetailContext);

  const intl = useIntl();
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>(
    FAKE_ALL_NETWORK.id,
  );
  const { accountId, networkId, price } = context?.routeParams ?? {};
  const { account } = useAccount({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });
  const { symbol } = context?.detailInfo ?? {};
  const isVerticalLayout = useIsVerticalLayout();

  const { items, balance } =
    context || (freezedEmptyObject as ITokenDetailContext);

  const sections = useMemo(
    () =>
      Object.entries(groupBy(items, 'networkId')).map(([nid, data]) => {
        const network = allNetworks?.find((n) => n.id === nid);
        return {
          network,
          data,
        };
      }),
    [items, allNetworks],
  );

  const empty = useMemo(
    () => (
      <Empty
        mt="56px"
        emoji="🤑"
        title={intl.formatMessage({ id: 'empty__no_tokens' })}
        subTitle={intl.formatMessage(
          { id: 'empty__no_tokens_desc' },
          {
            0: symbol ?? '',
          },
        )}
      />
    ),
    [symbol, intl],
  );

  const renderSectionHeader = useCallback(
    ({ section: { network } }: { section: typeof sections[0] }) => {
      if (!network) {
        return null;
      }
      return (
        <Typography.Subheading mt="6" mb="2" color="text-subdued">
          {network?.name?.toUpperCase()}
        </Typography.Subheading>
      );
    },
    [],
  );

  const renderItem: ListRenderItem<IOverviewTokenDetailListItem> = useCallback(
    ({ item, index }) => {
      const token = {
        name: item.name,
        logoURI: item.logoURI,
      };

      const value = new B(item.balance ?? 0).multipliedBy(price ?? 0);

      const balanceBN = new B(balance ?? 0);

      const rate =
        balanceBN.isNaN() || balanceBN.isEqualTo(0)
          ? new B(100)
          : new B(item.balance ?? 0).dividedBy(balanceBN).multipliedBy(100);

      const proportion = `${rate.toFixed(2)}%`;

      const formatedBalance = (
        <FormatBalance
          balance={item.balance}
          suffix={item?.symbol}
          formatOptions={{
            fixed: 6,
          }}
        />
      );

      const tokenItem = (
        <HStack alignItems="center" flex={1}>
          {item.type === 'Token' ? (
            <Box
              size="8"
              borderRadius="999px"
              bg="action-primary-default"
              justifyContent="center"
              alignItems="center"
            >
              <Icon size={20} color="icon-on-primary" name="WalletOutline" />
            </Box>
          ) : (
            <Image
              size={8}
              borderRadius="full"
              source={
                typeof token.logoURI === 'number'
                  ? token.logoURI
                  : {
                      uri: token.logoURI,
                    }
              }
            />
          )}
          <VStack ml="3" alignItems="flex-start">
            <Typography.Body1Strong isTruncated maxW={56} numberOfLines={1}>
              {item.type === 'Token'
                ? item.accountName || account?.name || item.name
                : item.name}
            </Typography.Body1Strong>
            {isVerticalLayout ? (
              <Tooltip
                label={intl.formatMessage({ id: 'msg__asset_ratio' })}
                placement="top"
              >
                <Box>
                  <Badge size="sm" type="info" title={proportion} mt="1" />
                </Box>
              </Tooltip>
            ) : null}
          </VStack>
        </HStack>
      );

      if (isVerticalLayout) {
        return (
          <ListItem mx="-8px" onPress={item.onPress}>
            <ListItem.Column flex="1">{tokenItem}</ListItem.Column>
            <ListItem.Column
              flex={1}
              alignItems="flex-end"
              text={{
                label: (
                  <Typography.Body1Strong>
                    <FormatCurrencyNumber value={0} convertValue={value} />
                  </Typography.Body1Strong>
                ),
                description: (
                  <Typography.Body2 color="text-subdued">
                    {formatedBalance}
                  </Typography.Body2>
                ),
              }}
            />
          </ListItem>
        );
      }
      return (
        <>
          {index !== 0 ? (
            <Box borderBottomWidth={1} borderColor="divider" />
          ) : null}
          <ListItem mx="-8px" py={4} onPress={item.onPress}>
            {tokenItem}
            <Box flex={1} flexDirection="row" justifyContent="flex-end">
              <Tooltip
                label={intl.formatMessage({ id: 'msg__asset_ratio' })}
                placement="top"
              >
                <Box>
                  <Badge size="sm" type="info" title={proportion} />
                </Box>
              </Tooltip>
            </Box>
            <ListItem.Column
              flex={1}
              text={{
                label: (
                  <Typography.Body1Strong textAlign="right">
                    {formatedBalance}
                  </Typography.Body1Strong>
                ),
              }}
            />
            <ListItem.Column
              flex={1}
              text={{
                label: (
                  <Typography.Body1Strong textAlign="right">
                    <FormatCurrencyNumber value={0} convertValue={value} />
                  </Typography.Body1Strong>
                ),
              }}
            />
          </ListItem>
        </>
      );
    },
    [isVerticalLayout, price, balance, account?.name, intl],
  );

  return (
    <Tabs.SectionList
      contentContainerStyle={{
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: isVerticalLayout ? 16 : 32,
      }}
      renderSectionHeader={renderSectionHeader}
      sections={sections.filter((s) => {
        if (selectedNetworkId === FAKE_ALL_NETWORK.id) {
          return true;
        }
        return s.network?.id === selectedNetworkId;
      })}
      renderItem={renderItem}
      stickySectionHeadersEnabled={false}
      keyExtractor={(item) =>
        `${item.networkId}__${item.name}__${item.balance}__${
          item.address ?? ''
        }`
      }
      ListFooterComponent={items?.length ? null : empty}
      ListHeaderComponent={
        <Header
          networks={sections.map((s) => s.network)}
          value={selectedNetworkId}
          onChange={(id) => setSelectedNetworkId(id)}
        />
      }
    />
  );
};

export default AssetsInfo;
