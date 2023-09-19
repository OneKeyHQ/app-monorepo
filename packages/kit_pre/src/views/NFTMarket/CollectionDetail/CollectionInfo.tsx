import type { ComponentProps, FC } from 'react';
import { useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Text, useIsVerticalLayout } from '@onekeyhq/components';

import { useNavigation } from '../../../hooks';
import CollectionLogo from '../CollectionLogo';
import { PriceString } from '../PriceText';

import { useCollectionDetailContext } from './context';

const CollectionInfo: FC<ComponentProps<typeof Box>> = ({ ...props }) => {
  const context = useCollectionDetailContext()?.context;
  const collection = context?.collection;
  const name = collection?.contractName ?? collection?.name ?? '';
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation();

  useEffect(() => {
    if (!isVerticalLayout) {
      navigation.setOptions({ title: name });
    }
  }, [isVerticalLayout, name, navigation]);

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
        value: PriceString({
          price: collection?.floorPrice,
          symbol: collection?.priceSymbol,
          networkId: context?.networkId,
        }),
      },
      {
        key: intl.formatMessage({
          id: 'content__blue_chip_rates',
        }),
        value: collection?.blueChip?.next_blue_chip_probability,
      },
      {
        key: intl.formatMessage(
          {
            id: 'content__int_hours_volume',
          },
          { 0: 24 },
        ),
        value: PriceString({
          price: collection?.volume24h,
          symbol: collection?.priceSymbol,
          networkId: context?.networkId,
        }),
      },
    ],
    [
      collection?.blueChip?.next_blue_chip_probability,
      collection?.floorPrice,
      collection?.itemsTotal,
      collection?.ownersTotal,
      collection?.priceSymbol,
      collection?.volume24h,
      context?.networkId,
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
        <CollectionLogo
          src={collection?.logoUrl}
          width="64px"
          height="64px"
          verified={collection?.openseaVerified}
        />
        <Box ml={{ base: '16px', md: '24px' }} maxW="576px" flex={1}>
          <Text typography="PageHeading" mb="4px" numberOfLines={1}>
            {name || '–'}
          </Text>
          <Box mt="4px">
            {isVerticalLayout ? (
              <Text typography="Body2" color="text-subdued">
                {intl.formatMessage(
                  {
                    id: 'content__int_items',
                  },
                  { 0: collection?.itemsTotal },
                )}
              </Text>
            ) : (
              Description
            )}
          </Box>
        </Box>
      </Box>

      {isVerticalLayout ? <Box mt="16px">{Description}</Box> : null}

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
              width={{ base: '50%', sm: '33.33%', md: 'auto' }}
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
