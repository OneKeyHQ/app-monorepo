import type { FC } from 'react';
import { useCallback, useContext, useMemo } from 'react';

import B from 'bignumber.js';
import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  HStack,
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
import { useManageNetworks } from '../../../hooks';
import { TokenDetailContext } from '../context';

import type { IOverviewTokenDetailListItem } from '../../Overview/types';
import type { ListRenderItem } from 'react-native';

const AssetsInfo: FC = () => {
  const intl = useIntl();
  const { allNetworks } = useManageNetworks();
  const context = useContext(TokenDetailContext);

  const { price } = context?.routeParams ?? {};
  const { items } = context?.positionInfo ?? {};
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
    ({ section: { network, data } }: { section: typeof sections[0] }) => {
      if (!network) {
        return null;
      }
      return (
        <VStack mt="6">
          <HStack>
            <Token
              size="5"
              showInfo
              token={{
                name: network?.name?.toUpperCase(),
                logoURI: network?.logoURI,
              }}
            />
            <Badge ml="3" size="sm" title={String(data?.length ?? 0)} />
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
                      id: 'content__type',
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

      const formatedBalance = (
        <FormatBalance
          balance={item.balance}
          suffix={item?.symbol}
          formatOptions={{
            fixed: 6,
          }}
        />
      );
      if (isVerticalLayout) {
        return (
          <ListItem mx="-8px">
            <ListItem.Column>
              <Token
                flex="1"
                size="40px"
                showInfo
                token={token}
                showExtra={false}
                description={formatedBalance}
                infoBoxProps={{ flex: 1 }}
              />
            </ListItem.Column>
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
                  <Box>
                    <Badge size="sm" type="info" title={item.type} />
                  </Box>
                ),
              }}
            />
          </ListItem>
        );
      }
      return (
        <>
          <Box borderBottomWidth={1} borderColor="divider" />
          <ListItem mx="-8px" py={4}>
            <Token
              flex={3}
              size="32px"
              showInfo
              showDescription={false}
              token={token}
              showExtra={false}
              infoBoxProps={{ flex: 1 }}
            />
            <Box flex={1} flexDirection="row" justifyContent="flex-end">
              <Badge
                size="sm"
                type="info"
                title={intl.formatMessage({ id: 'form__token' })}
              />
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
    [intl, isVerticalLayout, price],
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
