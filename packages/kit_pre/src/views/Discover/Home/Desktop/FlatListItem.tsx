import type { FC } from 'react';
import { useContext, useMemo, useRef, useState } from 'react';

import { chunk } from 'lodash';

import { Box, Pressable, Typography } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useDebounce } from '../../../../hooks';
import { Chains } from '../../Chains';
import DAppIcon from '../../components/DAppIcon';
import FavContainer from '../../Explorer/FavContainer';
import { DiscoverContext } from '../context';
import { SectionTitle } from '../SectionTitle';
import { SeeAllButton } from '../SeeAllButton';
import { SelectorButton } from '../SelectorButton';

import type { DAppItemType, GroupDappsType } from '../../type';

type CardProps = {
  item: DAppItemType;
  cardWidth: number;
};

const Card: FC<CardProps> = ({ item, cardWidth }) => {
  const ref = useRef<any>(null);
  const hoverButtonProps = useMemo(
    () => ({
      right: '20px',
      top: '20px',
      iconSize: 20,
    }),
    [],
  );
  const { onItemSelect } = useContext(DiscoverContext);
  return (
    <FavContainer url={item.url} hoverButtonProps={hoverButtonProps}>
      <Box
        width={cardWidth}
        maxWidth={cardWidth}
        minWidth={cardWidth}
        height={156}
        paddingX="2"
        justifyContent="center"
        alignItems="center"
      >
        <Pressable
          flexDirection="column"
          borderRadius="12px"
          padding="4"
          width={cardWidth - 16}
          height={128}
          borderWidth={1}
          _hover={{ bgColor: 'surface-hovered' }}
          borderColor="border-subdued"
          onPress={() => {
            if (platformEnv.isDesktop) {
              // eslint-disable-next-line
              ref.current?.blur?.();
            }
            onItemSelect?.(item);
          }}
          ref={ref}
        >
          <Box flexDirection="row">
            <DAppIcon
              size={48}
              url={item.logoURL}
              networkIds={item.networkIds}
            />
            <Box ml="3" flex="1">
              <Typography.Body2Strong numberOfLines={1} mb="1" flex="1">
                {item.name}
              </Typography.Body2Strong>
              <Chains networkIds={item.networkIds} />
            </Box>
          </Box>
          <Typography.Caption
            mt="3"
            numberOfLines={2}
            textAlign="left"
            color="text-subdued"
          >
            {item.subtitle}
          </Typography.Caption>
        </Pressable>
      </Box>
    </FavContainer>
  );
};

type SectionRowProps = {
  items: DAppItemType[];
  cardWidth: number;
};

const SectionRow: FC<SectionRowProps> = ({ items, cardWidth }) => (
  <Box flexDirection="row" alignItems="center">
    {items.map((item) => (
      <Card key={item._id} item={item} cardWidth={cardWidth} />
    ))}
  </Box>
);

type SectionsProps = {
  width: number;
  data: DAppItemType[];
};

const Sections: FC<SectionsProps> = (props) => {
  const { width, data } = props;
  const screenWidth = width - 66;
  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;
  const sections = chunk(data, numColumns).map((items) => ({
    key: items[0]._id,
    items,
  }));

  return (
    <Box pl="6">
      {sections?.map((section) => (
        <SectionRow
          items={section.items}
          key={section.key}
          cardWidth={cardWidth}
        />
      ))}
    </Box>
  );
};

type FlatListItemProps = {
  data: GroupDappsType;
  width: number;
};

export const FlatListItem: FC<FlatListItemProps> = ({ data, width }) => {
  const w = useDebounce(width, 1000);
  const [networkId, setNetworkId] = useState('all--0');

  const networkIds = useMemo(() => {
    let items = [] as string[];
    items = items.concat(...data.items.map((o) => o.networkIds));
    return Array.from(new Set(items));
  }, [data]);

  const items = useMemo(() => {
    if (isAllNetworks(networkId)) {
      return data.items;
    }
    return data.items.filter((o) => o.networkIds.includes(networkId));
  }, [networkId, data]);

  return (
    <Box w="100%" mt="8">
      <SectionTitle title={data.label}>
        {data.id ? (
          <SeeAllButton title={data.label} tagId={data.id} />
        ) : (
          <SelectorButton
            networkIds={networkIds}
            networkId={networkId}
            onItemSelect={setNetworkId}
          />
        )}
      </SectionTitle>
      <Sections data={items} width={w} />
    </Box>
  );
};
