import type { FC } from 'react';
import { useCallback, useContext, useMemo } from 'react';

import B from 'bignumber.js';
import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  HStack,
  Icon,
  ListItem,
  Token,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { useAccount, useManageNetworks } from '../../../hooks';
import { TokenDetailContext } from '../context';

import type { IOverviewTokenDetailListItem } from '../../Overview/types';
import type { ListRenderItem } from 'react-native';

const AssetsInfo: FC = () => {
  const intl = useIntl();
  const { allNetworks } = useManageNetworks();
  const context = useContext(TokenDetailContext);

  const { price, networkId, accountId } = context?.routeParams ?? {};
  const { account } = useAccount({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });
  const { items, balance } = context?.positionInfo ?? {};
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

  const renderSectionHeader = useCallback(
    ({ section: { network } }: { section: typeof sections[0] }) => {
      if (!network) {
        return null;
      }
      return (
        <VStack mt="6">
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

          <>
            {!isVerticalLayout ? (
              <ListItem py={4} mx="-8px">
                <ListItem.Column
                  flex={3}
                  text={{
                    label: intl.formatMessage({
                      id: 'form__position_uppercase',
                    }),
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                    },
                  }}
                />
                <ListItem.Column
                  flex={1}
                  text={{
                    label: intl.formatMessage({
                      id: 'form__proportion_uppercase',
                    }),
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                      textAlign: 'right',
                    },
                  }}
                />
                <ListItem.Column
                  flex={2.5}
                  text={{
                    label: intl.formatMessage({
                      id: 'content__balance',
                    }),
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                      textAlign: 'right',
                    },
                  }}
                />
                <ListItem.Column
                  flex={2.5}
                  text={{
                    label: intl.formatMessage({
                      id: 'form__value_uppercase',
                    }),
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                      textAlign: 'right',
                    },
                  }}
                />
              </ListItem>
            ) : null}
          </>
        </VStack>
      );
    },
    [isVerticalLayout, intl],
  );

  const renderItem: ListRenderItem<IOverviewTokenDetailListItem> = useCallback(
    ({ item }) => {
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
        <HStack flex="3" alignItems="center">
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
            <Token
              size={8}
              token={{
                logoURI: token.logoURI,
              }}
            />
          )}
          <VStack ml="3" alignItems="flex-start">
            <Typography.Body1Strong>
              {item.type === 'Token'
                ? item.accountName || account?.name || item.name
                : item.name}
            </Typography.Body1Strong>
            <Box>
              {isVerticalLayout ? (
                <Badge size="sm" type="info" title={proportion} mt="1" />
              ) : null}
            </Box>
          </VStack>
        </HStack>
      );

      if (isVerticalLayout) {
        return (
          <ListItem mx="-8px" onPress={item.onPress}>
            <ListItem.Column>{tokenItem}</ListItem.Column>
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
          <Box borderBottomWidth={1} borderColor="divider" />
          <ListItem mx="-8px" py={4} onPress={item.onPress}>
            {tokenItem}
            <Box flex={1} flexDirection="row" justifyContent="flex-end">
              <Badge size="sm" type="info" title={proportion} />
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
    [isVerticalLayout, price, balance, account?.name],
  );

  return (
    <Tabs.SectionList
      contentContainerStyle={{
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: isVerticalLayout ? 16 : 32,
      }}
      renderSectionHeader={renderSectionHeader}
      sections={sections}
      renderItem={renderItem}
      keyExtractor={(item) =>
        `${item.networkId}__${item.name}__${item.balance}__${
          item.address ?? ''
        }`
      }
    />
  );
};

export default AssetsInfo;
