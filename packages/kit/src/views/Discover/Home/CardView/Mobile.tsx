import type { FC } from 'react';

import { Box, Pressable, ScrollView, Typography } from '@onekeyhq/components';

import { useTranslation } from '../../../../hooks';
import DAppIcon from '../../DAppIcon';
import { SectionTitle } from '../TitleView';

import type { DAppItemType, SectionDataType } from '../../type';
import type { ResponsiveValue } from 'native-base/lib/typescript/components/types';

type DappTypeTuple = [DAppItemType | undefined, DAppItemType | undefined];

interface SimpleCardViewProps {
  item: DAppItemType;
  onItemSelect: SectionDataType['onItemSelect'];
  mt?: ResponsiveValue<string | number>;
}

const SimpleCardView: FC<SimpleCardViewProps> = ({
  item,
  onItemSelect,
  mt,
}) => {
  const t = useTranslation();
  return (
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
          {t(item._subtitle) ?? item.subtitle}
        </Typography.Caption>
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
        <SimpleCardView item={itemA} onItemSelect={onItemSelect} />
      ) : null}
      {itemB ? (
        <SimpleCardView item={itemB} onItemSelect={onItemSelect} mt="5" />
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
        {sections.map((section, index) => (
          <PairCardView
            key={index}
            items={section}
            onItemSelect={onItemSelect}
          />
        ))}
      </ScrollView>
    </Box>
  );
};
