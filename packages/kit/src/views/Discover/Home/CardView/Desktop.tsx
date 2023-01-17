import type { FC } from 'react';

import { chunk } from 'lodash';
import { useWindowDimensions } from 'react-native';

import { Box, Pressable, Typography } from '@onekeyhq/components';

import { useDebounce, useTranslation } from '../../../../hooks';
import { Chains } from '../../Chains';
import DAppIcon from '../../DAppIcon';
import { SectionTitle } from '../TitleView';

import type { DAppItemType, SectionDataType } from '../../type';

type RowProps = {
  items: DAppItemType[];
  cardWidth: number;
  onItemSelect?: (o: DAppItemType) => void;
};

const Row: FC<RowProps> = ({ items, cardWidth, onItemSelect }) => {
  const t = useTranslation();
  return (
    <Box flexDirection="row" alignItems="center">
      {items.map((item) => (
        <Box
          key={item._id}
          width={cardWidth}
          maxWidth={cardWidth}
          minWidth={cardWidth}
          height={156}
          paddingX="2"
          justifyContent="center"
          alignItems="center"
        >
          <Pressable
            bgColor="surface-default"
            flexDirection="column"
            borderRadius="12px"
            padding="4"
            width={cardWidth - 16}
            height={144}
            borderWidth={1}
            _hover={{ bgColor: 'surface-hovered' }}
            borderColor="border-subdued"
            onPress={() => {
              onItemSelect?.(item);
            }}
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
              {t(item._subtitle) ?? item.subtitle}
            </Typography.Caption>
          </Pressable>
        </Box>
      ))}
    </Box>
  );
};

type SectionsProps = {
  width: number;
  data: DAppItemType[];
  onItemSelect?: (o: DAppItemType) => void;
};

const Sections: FC<SectionsProps> = (props) => {
  const { width, data, onItemSelect } = props;
  const screenWidth = width - 270 - 48;
  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;
  const filterData = data.slice(0, 8);
  const sections = chunk(filterData, numColumns).map((items) => ({
    key: items[0]._id,
    items,
  }));

  return (
    <Box pl="6">
      {sections?.map((section) => (
        <Row
          items={section.items}
          key={section.key}
          onItemSelect={onItemSelect}
          cardWidth={cardWidth}
        />
      ))}
    </Box>
  );
};

export const Desktop: FC<SectionDataType> = ({
  title,
  _title,
  data,
  onItemSelect,
  tagId,
}) => {
  const { width } = useWindowDimensions();
  const w = useDebounce(width, 1000);
  return (
    <Box w="100%" mt="8">
      <SectionTitle
        title={title}
        _title={_title}
        tagId={tagId}
        onItemSelect={onItemSelect}
      />
      <Sections data={data} onItemSelect={onItemSelect} width={w} />
    </Box>
  );
};
