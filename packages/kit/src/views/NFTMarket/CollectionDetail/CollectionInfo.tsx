import React, { ComponentProps, FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Hidden, Text, useIsVerticalLayout } from '@onekeyhq/components';

import CollectionLogo from '../CollectionLogo';

import { useCollectionDetailContext } from './context';

const CollectionInfo: FC<ComponentProps<typeof Box>> = ({ ...props }) => {
  const context = useCollectionDetailContext()?.context;
  const collection = context?.collection;
  const name = collection?.contractName ?? collection?.name ?? '';
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const statsIndex = useMemo(
    () => [
      !isVerticalLayout
        ? {
            key: intl.formatMessage({
              id: 'content__items',
            }),
            value: collection?.itemsTotal,
          }
        : null,
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
      isVerticalLayout,
    ],
  );

  const Description = (
    <Text typography="Body2" color="text-subdued" numberOfLines={2}>
      {collection?.description ||
        intl.formatMessage({ id: 'content__no_description' })}
    </Text>
  );

  return (
    <Box {...props}>
      <Box flexDirection="row">
        <CollectionLogo src={collection?.logoUrl} width="64px" height="64px" />
        <Box ml={{ base: '16px', md: '24px' }} maxW="576px">
          <Text typography="PageHeading" mb="4px" numberOfLines={1}>
            {name || '–'}
          </Text>
          <Box mt="4px">
            <Hidden from="base" till="md">
              {Description}
            </Hidden>
            <Hidden from="md">
              <Text typography="Body2" color="text-subdued">
                {intl.formatMessage(
                  {
                    id: 'content__int_items',
                  },
                  { 0: collection?.itemsTotal },
                )}
              </Text>
            </Hidden>
          </Box>
        </Box>
      </Box>

      <Hidden from="md">
        <Box mt="16px">{Description}</Box>
      </Hidden>

      <Box
        flexDirection="row"
        mt="24px"
        flexWrap="wrap"
        mb={{ base: '-16px', md: 0 }}
      >
        {statsIndex.map((item) =>
          item ? (
            <Box
              mr={{ md: '32px' }}
              mb={{ base: '16px', md: 0 }}
              width={{ base: '50%', md: 'auto' }}
            >
              <Text typography="Body2" color="text-subdued">
                {item.key}
              </Text>
              <Text typography="Body1Strong" mt="4px">
                {item.value || '-'}
              </Text>
            </Box>
          ) : null,
        )}
      </Box>
    </Box>
  );
};

export default CollectionInfo;
