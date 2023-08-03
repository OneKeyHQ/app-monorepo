import type { FC } from 'react';
import { useRef } from 'react';

import { chunk } from 'lodash';
import { useWindowDimensions } from 'react-native';

import { Box, Pressable, Typography } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useDebounce } from '../../../../hooks';
import { Chains } from '../../Chains';
import DAppIcon from '../../components/DAppIcon';
import FavContainer from '../../Explorer/FavContainer';
import { SectionTitle } from '../TitleView';

import type { DAppItemType, SectionDataType } from '../../type';

type RowProps = {
  items: DAppItemType[];
  cardWidth: number;
  onItemSelect?: (o: DAppItemType) => void;
};

const Card: FC<{
  item: DAppItemType;
  cardWidth: number;
  onItemSelect?: (o: DAppItemType) => void;
}> = ({ item, cardWidth, onItemSelect }) => {
  const ref = useRef<any>(null);
  return (
    <FavContainer
      url={item.url}
      hoverButtonProps={{
        right: '20px',
        top: '20px',
        iconSize: 20,
      }}
    >
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

const Row: FC<RowProps> = ({ items, cardWidth, onItemSelect }) => (
  <Box flexDirection="row" alignItems="center">
    {items.map((item) => (
      <Card
        key={item._id}
        item={item}
        cardWidth={cardWidth}
        onItemSelect={onItemSelect}
      />
    ))}
  </Box>
);

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
