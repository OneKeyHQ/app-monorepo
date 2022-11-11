import React, { ComponentProps, FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Text, useIsVerticalLayout } from '@onekeyhq/components';
import { Collection } from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../CollectionLogo';

import { useCollectionDetailContext } from './context';

type Props = {
  collection?: Collection;
};

const Desktop: FC<Props> = ({ collection }) => {
  const name = collection?.contractName ?? collection?.name ?? '';
  const intl = useIntl();

  const statsIndex = useMemo(
    () => [
      {
        key: intl.formatMessage({
          id: 'content__items',
        }),
        value: collection?.itemsTotal,
      },
      {
        key: intl.formatMessage({
          id: 'content__owners',
        }),
        value: collection?.ownersTotal,
      },
      {
        key: intl.formatMessage({
          id: 'content__floor',
        }),
        value: collection?.floorPrice,
      },
      {
        key: intl.formatMessage({
          id: 'content__blue_chip_rates',
        }),
        value: collection?.NBCP,
      },
      {
        key: intl.formatMessage(
          {
            id: 'content__int_hours_volume',
          },
          { 0: 24 },
        ),
        value: collection?.volume24h,
      },
    ],
    [
      collection?.NBCP,
      collection?.floorPrice,
      collection?.itemsTotal,
      collection?.ownersTotal,
      collection?.volume24h,
      intl,
    ],
  );

  return (
    <Box>
      <Box flexDirection="row">
        <CollectionLogo src={collection?.logoUrl} width="64px" height="64px" />
        <Box ml={{ base: '16px', md: '24px' }}>
          <Text typography="PageHeading" mb="4px" numberOfLines={1}>
            {name}
          </Text>
          <Text typography="Body2" color="text-subdued" numberOfLines={2}>
            {collection?.description}
          </Text>
        </Box>
      </Box>

      <Box flexDirection="row" mt="24px">
        {statsIndex.map((item) => (
          <Box mr="32px">
            <Text typography="Body2" color="text-subdued">
              {item.key}
            </Text>
            <Text typography="Body1Strong" mt="4px">
              {item.value || '-'}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const Mobile: FC<Props> = ({ collection }) => {
  const name = collection?.contractName ?? collection?.name ?? '';
  const intl = useIntl();

  return (
    <Box
      h={296}
      w="100%"
      flexDirection="column"
      padding="16px"
      bgColor="background-default"
    >
      <Box flexDirection="row">
        <CollectionLogo src={collection?.logoUrl} width="64px" height="64px" />
        <Box flexDirection="column" ml="16px" justifyContent="center" flex={1}>
          <Text typography="PageHeading" mb="4px" numberOfLines={1}>
            {name}
          </Text>
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage(
              {
                id: 'content__int_items',
              },
              { 0: collection?.itemsTotal },
            )}
          </Text>
        </Box>
      </Box>

      <Text mt="16px" typography="Body2" color="text-subdued" numberOfLines={2}>
        {collection?.description}
      </Text>

      <Box flexDirection="row" mt="24px">
        <Box flex={1}>
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage({
              id: 'content__owners',
            })}
          </Text>
          <Text typography="Body1Strong" mt="4px">
            {collection?.ownersTotal}
          </Text>
        </Box>
        <Box flex={1}>
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage({
              id: 'content__floor',
            })}
          </Text>
          <Text typography="Body1Strong" mt="4px">
            {collection?.floorPrice ?? '-'}
          </Text>
        </Box>
      </Box>

      <Box flexDirection="row" mt="16px">
        <Box flex={1}>
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage({
              id: 'content__blue_chip_rates',
            })}
          </Text>
          <Text typography="Body1Strong" mt="4px">
            {collection?.NBCP ?? '-'}
          </Text>
        </Box>
        <Box flex={1}>
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage(
              {
                id: 'content__int_hours_volume',
              },
              { 0: 24 },
            )}
          </Text>
          <Text typography="Body1Strong" mt="4px">
            {collection?.volume24h}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

const CollectionInfo: FC<ComponentProps<typeof Box>> = ({ ...props }) => {
  const isSmallScreen = useIsVerticalLayout();
  const context = useCollectionDetailContext()?.context;

  return (
    <Box {...props}>
      {isSmallScreen ? (
        <Mobile collection={context?.collection} />
      ) : (
        <Desktop collection={context?.collection} />
      )}
    </Box>
  );
};

export default CollectionInfo;
