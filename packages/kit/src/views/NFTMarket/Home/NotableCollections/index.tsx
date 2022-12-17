import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import { Box, Text } from '@onekeyhq/components';
import ScrollableButtonGroup from '@onekeyhq/components/src/ScrollableButtonGroup/ScrollableButtonGroup';
import type { Collection } from '@onekeyhq/engine/src/types/nft';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useCollectionDetail } from '../hook';

import CollectionCard from './CollectionCard/CollectionCard';
import EmptyView from './EmptyView';

type Props = {
  listData: Collection[];
  onSelectCollection: (collection: Collection) => void;
};

const ListView: FC<Props> = ({ listData, onSelectCollection }) => {
  const ref = useRef(null);

  const renderItem = useCallback(
    (item: Collection, index: number) => {
      const {
        bannerUrl,
        contractName,
        floorPrice,
        chain,
        priceSymbol,
        openseaVerified,
      } = item;
      return (
        <CollectionCard
          key={`${item.contractAddress as string} ${index}`}
          onPress={() => {
            onSelectCollection(item);
          }}
          contractName={contractName}
          verified={openseaVerified}
          netImageProps={{ src: bannerUrl }}
          priceTextProps={{
            price: floorPrice,
            networkId: chain,
            symbol: priceSymbol,
          }}
          style={{ marginRight: 16 }}
        />
      );
    },
    [onSelectCollection],
  );

  const Banners = useMemo(
    () => listData.map((item, index) => renderItem(item, index)),
    [listData, renderItem],
  );

  return (
    <ScrollableButtonGroup
      justifyContent="center"
      bg="transparent"
      ref={ref}
      leftButtonProps={{
        size: 'base',
        type: 'basic',
        ml: '16px',
      }}
      rightButtonProps={{
        size: 'base',
        type: 'basic',
        mr: '16px',
      }}
    >
      {Banners}
    </ScrollableButtonGroup>
  );
};

const NotableCollection = () => {
  const { serviceNFT } = backgroundApiProxy;
  const [listData, updateListData] = useState<Collection[]>([]);
  const intl = useIntl();
  const goToCollectionDetail = useCollectionDetail();

  useEffect(() => {
    (async () => {
      const data = await serviceNFT.getMarketCollection();
      updateListData(data);
    })();
  }, [serviceNFT]);

  const onSelectCollection = useCallback(
    (collection: Collection) => {
      goToCollectionDetail({
        networkId: collection.chain as string,
        contractAddress: collection.contractAddress as string,
        collection,
      });
    },
    [goToCollectionDetail],
  );

  return (
    <Box>
      <Text typography="Heading" mb="16px">
        {intl.formatMessage({
          id: 'content__notable_collections',
        })}
      </Text>
      <Box mr={{ base: '-16px', md: 0 }}>
        {listData.length === 0 ? (
          <EmptyView />
        ) : (
          <MotiView
            style={{ flex: 1 }}
            from={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
          >
            <ListView
              listData={listData}
              onSelectCollection={onSelectCollection}
            />
          </MotiView>
        )}
      </Box>
    </Box>
  );
};

export default memo(NotableCollection);
