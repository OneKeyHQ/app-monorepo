import type { FC } from 'react';

import { Box, Pressable, ScrollView, Typography } from '@onekeyhq/components';

import { useTranslation } from '../../../../hooks';
import DAppIcon from '../../DAppIcon';
import { SectionTitle } from '../TitleView';

import type { DAppItemType, SectionDataType } from '../../type';

type DappTypeTuple = [DAppItemType | undefined, DAppItemType | undefined];

type SimpleCardViewProps = {
  item: DAppItemType;
  onItemSelect: SectionDataType['onItemSelect'];
};

const SimpleCardView: FC<SimpleCardViewProps> = ({ item, onItemSelect }) => {
  const t = useTranslation();
  return (
    <Pressable
      onPress={() => {
        onItemSelect?.(item);
      }}
    >
      <Box
        width="260px"
        ml="4"
        borderRadius="12px"
        alignItems="center"
        flexDirection="row"
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
            {t(item._subtitle) ?? item.subtitle}
          </Typography.Caption>
        </Box>
      </Box>
    </Pressable>
  );
};

type PairCardViewProps = {
  items: DappTypeTuple;
  onItemSelect: SectionDataType['onItemSelect'];
};

const PairCardView: FC<PairCardViewProps> = ({ items, onItemSelect }) => {
  const itemA = items[0];
  const itemB = items[1];
  return (
    <Box>
      {itemA ? (
        <Box>
          <SimpleCardView item={itemA} onItemSelect={onItemSelect} />
        </Box>
      ) : null}
      {itemB ? (
        <Box mt="5">
          <SimpleCardView item={itemB} onItemSelect={onItemSelect} />
        </Box>
      ) : null}
    </Box>
  );
};

const group = (items: DAppItemType[]) => {
  const result: DappTypeTuple[] = [];
  for (let i = 0; i < items.length; i += 2) {
    result.push([items[i], items[i + 1]]);
  }
  return result;
};

export const Mobile: FC<SectionDataType> = ({
  title,
  data,
  tagId,
  _title,
  onItemSelect,
}) => {
  const sections = group(data);
  return (
    <Box width="100%" mt="8">
      <SectionTitle
        tagId={tagId}
        title={title}
        _title={_title}
        onItemSelect={onItemSelect}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Box flexDirection="row">
          {sections.map((section) => (
            <PairCardView
              key={section[0]?._id ?? ''}
              items={section}
              onItemSelect={onItemSelect}
            />
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
};
