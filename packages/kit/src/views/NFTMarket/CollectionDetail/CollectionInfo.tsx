import React, { FC } from 'react';

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

  return (
    <Box
      width="full"
      h="216px"
      flexDirection="column"
      paddingX="51px"
      mt="32px"
    >
      <Box flexDirection="row">
        <CollectionLogo src={collection?.logoUrl} width="64px" height="64px" />
        <Box flexDirection="column" ml="21px" justifyContent="center" flex={1}>
          <Text typography="PageHeading" mb="4px" numberOfLines={1}>
            {name}
          </Text>
          <Text
            mt="16px"
            typography="Body2"
            color="text-subdued"
            numberOfLines={2}
          >
            {collection?.description}
          </Text>
        </Box>
      </Box>

      <Box flexDirection="row" mt="24px">
        <Box mr="32px">
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage({
              id: 'content__items',
            })}
          </Text>
          <Text typography="Body1Strong" mt="4px">
            {collection?.itemsTotal}
          </Text>
        </Box>
        <Box mr="32px">
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage({
              id: 'content__owners',
            })}
          </Text>
          <Text typography="Body1Strong" mt="4px">
            {collection?.ownersTotal}
          </Text>
        </Box>
        <Box mr="32px">
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage({
              id: 'content__floor',
            })}
          </Text>
          <Text typography="Body1Strong" mt="4px">
            {collection?.floorPrice ?? '-'}
          </Text>
        </Box>

        <Box mr="32px">
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage({
              id: 'content__blue_chip_rates',
            })}
          </Text>
          <Text typography="Body1Strong" mt="4px">
            {collection?.NBCP ?? '-'}
          </Text>
        </Box>
        <Box mr="32px">
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

const CollectionInfo: FC = () => {
  const isSmallScreen = useIsVerticalLayout();
  const context = useCollectionDetailContext()?.context;

  return isSmallScreen ? (
    <Mobile collection={context?.collection} />
  ) : (
    <Desktop collection={context?.collection} />
  );
};

export default CollectionInfo;
