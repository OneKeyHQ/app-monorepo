import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import { Box, List, ListItem, Text } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type {
  Collection,
  NFTMarketRanking,
} from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../../../../CollectionLogo';
import { PriceString } from '../../../../PriceText';
import EmptyView from '../../EmptyView';

import type { ListRenderItem } from 'react-native';

type Props = {
  listData: NFTMarketRanking[];
  selectNetwork?: Network;
  onSelectCollection?: ({
    collection,
    networkId,
    contractAddress,
    title,
  }: {
    collection?: Collection;
    networkId: string;
    contractAddress: string;
    title?: string;
  }) => void;
} & Pick<
  ComponentProps<typeof List>,
  'ListHeaderComponent' | 'ListFooterComponent' | 'headerProps'
>;

const Mobile: FC<Props> = ({
  onSelectCollection,
  selectNetwork,
  listData,
  ...listProps
}) => {
  const intl = useIntl();
  const network = selectNetwork;

  const renderItem: ListRenderItem<NFTMarketRanking> = useCallback(
    ({ item, index }) => {
      const volumeChange = item.volume_change ?? '-';
      let volumeChangeBgColor;
      let volumeTextColor;
      if (item?.volume_change?.startsWith('-')) {
        //-
        volumeChangeBgColor = 'surface-critical-subdued';
        volumeTextColor = 'text-critical';
      } else if (!item?.volume_change?.startsWith('0.00%')) {
        //+
        volumeChangeBgColor = 'surface-success-subdued';
        volumeTextColor = 'text-success';
      } else {
        // 0
        volumeTextColor = 'text-subdued';
      }
      return (
        <ListItem
          onPress={() => {
            if (onSelectCollection) {
              onSelectCollection({
                contractAddress: item.contract_address as string,
                networkId: network?.id as string,
                title: item.contract_name,
              });
            }
          }}
        >
          <ListItem.Column>
            <CollectionLogo
              src={item.logo_url}
              width="56px"
              height="56px"
              verified={item.openseaVerified}
            />
          </ListItem.Column>
          <ListItem.Column
            text={{
              label: `${index + 1}`,
              labelProps: { pb: '24px', typography: 'Body1Mono' },
            }}
          />
          <ListItem.Column
            flex={1}
            text={{
              label: item.contract_name,
              labelProps: { isTruncated: true },
              description: PriceString({
                prefix: intl.formatMessage({
                  id: 'content__floor',
                }),
                price: item.floor_price,
                networkId: network?.id,
              }),
              descriptionProps: { numberOfLines: 1 },
            }}
          />
          <ListItem.Column
            alignItems="flex-end"
            text={{
              label: PriceString({
                price: new BigNumber(item.volume ?? '0')
                  .decimalPlaces(2)
                  .toString(),
                networkId: selectNetwork?.id,
              }),
              labelProps: { textAlign: 'right', numberOfLines: 1 },
              description: (
                <Box
                  borderRadius="6px"
                  bgColor={volumeChangeBgColor}
                  paddingX="6px"
                  paddingY="2px"
                >
                  <Text
                    typography="CaptionStrong"
                    color={volumeTextColor}
                    textAlign="right"
                    numberOfLines={1}
                  >
                    {volumeChange}
                  </Text>
                </Box>
              ),
            }}
          />
        </ListItem>
      );
    },
    [intl, network?.id, selectNetwork, onSelectCollection],
  );

  const ItemSeparatorComponent = useCallback(() => <Box h="4px" />, []);
  const ListFooterComponent = useCallback(() => <Box height="20px" />, []);

  if (listData === undefined || listData?.length === 0) {
    return (
      <EmptyView
        isTab={false}
        numberOfData={10}
        ListHeaderComponent={listProps.ListHeaderComponent}
      />
    );
  }
  return (
    <MotiView
      style={{ flex: 1 }}
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
    >
      <List
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          `${item.contract_address as string}${index}`
        }
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListFooterComponent={ListFooterComponent}
        {...listProps}
      />
    </MotiView>
  );
};
export default Mobile;
