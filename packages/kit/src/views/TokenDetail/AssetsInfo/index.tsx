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
  ScrollView,
  Token,
  Tooltip,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { FAKE_ALL_NETWORK } from '@onekeyhq/shared/src/config/fakeAllNetwork';

import dappColourPNG from '../../../../assets/dapp_colour.png';
import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { useAccount, useManageNetworks } from '../../../hooks';
import { TokenDetailContext } from '../context';

import type { IOverviewTokenDetailListItem } from '../../Overview/types';
import type { ListRenderItem } from 'react-native';

const Header: FC<{
  networks: ({ id: string; name?: string; logoURI: string } | undefined)[];
  onChange: (id: string) => void;
  value?: string;
}> = ({ networks, onChange, value }) => {
  if (networks.length <= 1) {
    return null;
  }
  return (
    <ScrollView horizontal w="100%" mt="6">
      {[FAKE_ALL_NETWORK, ...networks].map((n, index) => {
        if (!n?.id) {
          return;
        }
        return (
          <PressableItem
            onPress={() => onChange(n.id)}
            px={2}
            py="6px"
            borderRadius="9999px"
            bg={n.id === value ? 'surface-selected' : undefined}
            ml={index === 0 ? 0 : 2}
            key={n.id}
          >
            <HStack alignItems="center">
              <Image
                width="20px"
                height="20px"
                borderRadius="full"
                source={
                  isAllNetworks(n.id)
                    ? dappColourPNG
                    : {
                        uri: n.logoURI,
                      }
                }
              />
              <Typography.Body2Strong
                ml="1"
                color={n.id === value ? 'text-default' : 'text-subdued'}
              >
                {n.name}
              </Typography.Body2Strong>
            </HStack>
          </PressableItem>
        );
      })}
    </ScrollView>
  );
};

const AssetsInfo: FC = () => {
  const { allNetworks } = useManageNetworks();
  const context = useContext(TokenDetailContext);

  const intl = useIntl();
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>(
    FAKE_ALL_NETWORK.id,
  );
  const { price, networkId, accountId } = context?.routeParams ?? {};
  const { account } = useAccount({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });
  const { items, balance } = context?.positionInfo ?? {};
  const { symbol } = context?.detailInfo ?? {};
  const isVerticalLayout = useIsVerticalLayout();

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
        <VStack mt="6" mb="2">
          <HStack alignItems="center">
            <Token
              size="5"
              token={{
                logoURI: network?.logoURI,
              }}
            />
            <Typography.Subheading ml="2" color="text-subdued">
              {network?.name?.toUpperCase()}
            </Typography.Subheading>
          </HStack>
        </VStack>
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
        <HStack alignItems="center">
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
            <Typography.Body1Strong>
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
              flex={2.5}
              text={{
                label: (
                  <Typography.Body1Strong textAlign="right">
                    {formatedBalance}
                  </Typography.Body1Strong>
                ),
              }}
            />
            <ListItem.Column
              flex={2.5}
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
