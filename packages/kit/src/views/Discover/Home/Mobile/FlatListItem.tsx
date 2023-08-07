import { type FC, useContext, useMemo, useState } from 'react';

import { Box, Pressable, ScrollView, Typography } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import DAppIcon from '../../components/DAppIcon';
import FavContainer from '../../Explorer/FavContainer';
import { DiscoverContext } from '../context';
import { SectionTitle } from '../SectionTitle';
import { SeeAllButton } from '../SeeAllButton';
import { SelectorButton } from '../SelectorButton';

import type { DAppItemType, GroupDappsType } from '../../type';
import type { ResponsiveValue } from 'native-base/lib/typescript/components/types';

type DappTypeTuple = [DAppItemType | undefined, DAppItemType | undefined];

interface SimpleCardViewProps {
  item: DAppItemType;
  mt?: ResponsiveValue<string | number>;
}

const SimpleCardView: FC<SimpleCardViewProps> = ({ item, mt }) => {
  const { onItemSelect } = useContext(DiscoverContext);
  return (
    <FavContainer
      url={item.url}
      hoverButtonProps={{
        right: '4px',
        bottom: '30px',
      }}
    >
      <Pressable
        w="260px"
        ml="4"
        borderRadius="12px"
        alignItems="center"
        flexDirection="row"
        onPress={() => {
          onItemSelect?.(item);
        }}
        mt={mt}
      >
        <DAppIcon size={48} url={item.logoURL} networkIds={item.networkIds} />
        <Box flex={1} ml="2">
          <Typography.Body2Strong numberOfLines={1}>
            {item.name}
          </Typography.Body2Strong>
          <Typography.Caption
            numberOfLines={1}
            mt="1"
            color="text-subdued"
            overflow="hidden"
          >
            {item.subtitle}
          </Typography.Caption>
        </Box>
      </Pressable>
    </FavContainer>
  );
};

type PairCardViewProps = {
  items: DappTypeTuple;
};

const PairCardView: FC<PairCardViewProps> = ({ items: [itemA, itemB] }) => (
  <Box>
    {itemA ? <SimpleCardView item={itemA} /> : null}
    {itemB ? <SimpleCardView item={itemB} mt="5" /> : null}
  </Box>
);

const group = (items: DAppItemType[]) => {
  const result: DappTypeTuple[] = [];
  for (let i = 0; i < items.length; i += 2) {
    result.push([items[i], items[i + 1]]);
  }
  return result;
};

type GroupViewProps = {
  data: DAppItemType[];
  onItemSelect?: (item: DAppItemType) => void;
};

const HorizontalGroupView: FC<GroupViewProps> = ({ data }) => {
  const sections = group(data);
  return (
    <Box width="100%">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {sections.map((section, index) => (
          <PairCardView key={index} items={section} />
        ))}
      </ScrollView>
    </Box>
  );
};

const VerticalGroupViewItem: FC<{
  item: DAppItemType;
  onItemSelect?: (item: DAppItemType) => void;
}> = ({ item, onItemSelect }) => (
  <FavContainer
    url={item.url}
    hoverButtonProps={{
      right: '20px',
      top: '4px',
    }}
  >
    <Pressable
      flexDirection="row"
      px="4"
      pb="4"
      alignItems="center"
      onPress={() => onItemSelect?.(item)}
    >
      <Box mr={3}>
        <DAppIcon size={48} url={item.logoURL} networkIds={item.networkIds} />
      </Box>
      <Box flex={1}>
        <Typography.Body2Strong numberOfLines={1}>
          {item.name}
        </Typography.Body2Strong>
        <Typography.Caption numberOfLines={1} color="text-subdued">
          {item.subtitle}
        </Typography.Caption>
      </Box>
    </Pressable>
  </FavContainer>
);

const VerticalGroupView: FC<GroupViewProps> = ({ data, onItemSelect }) => (
  <Box>
    {data.map((o) => (
      <VerticalGroupViewItem key={o._id} item={o} onItemSelect={onItemSelect} />
    ))}
  </Box>
);

type FlatListItemProps = {
  data: GroupDappsType;
  onItemSelect?: (item: DAppItemType) => void;
};

export const FlatListItem: FC<FlatListItemProps> = ({ data, onItemSelect }) => {
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
    <Box w="full">
      <SectionTitle title={data.label}>
        {data.id ? (
          <SeeAllButton
            tagId={data.id}
            title={data.label}
            onItemSelect={onItemSelect}
          />
        ) : (
          <SelectorButton
            networkId={networkId}
            networkIds={networkIds}
            onItemSelect={setNetworkId}
          />
        )}
      </SectionTitle>
      {data.id ? (
        <HorizontalGroupView data={items} onItemSelect={onItemSelect} />
      ) : (
        <VerticalGroupView data={items} onItemSelect={onItemSelect} />
      )}
    </Box>
  );
};
