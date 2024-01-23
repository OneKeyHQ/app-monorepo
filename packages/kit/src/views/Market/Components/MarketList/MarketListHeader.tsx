import type { FC } from 'react';
import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  ListItem,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { EMarketCellData, MARKET_LIST_COLUMN_SHOW_WIDTH_1 } from '../../config';
import { useMarketWidthLayout } from '../../hooks/useMarketLayout';
import { useListSort } from '../../hooks/useMarketList';

import type { ListHeadTagType } from '../../types';

interface MarketListHeaderProps {
  headTags: ListHeadTagType[];
}

const MarketListHeader: FC<MarketListHeaderProps> = ({ headTags }) => {
  const listSort = useListSort();
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const { marketFillWidth } = useMarketWidthLayout();
  const ContainComponent = useMemo(
    () => (isVertical ? Box : ListItem),
    [isVertical],
  );
  const useDislocation = useMemo(
    () => isVertical || marketFillWidth <= MARKET_LIST_COLUMN_SHOW_WIDTH_1,
    [marketFillWidth, isVertical],
  );
  return (
    <Box mt="2" w="full">
      <ContainComponent flexDirection="row" px={2} py={1.5} my={0.5}>
        {headTags.map((tag) => {
          if (
            tag.id === EMarketCellData.CollectionStarOrSerialNumber ||
            tag.id === EMarketCellData.TokenInfo ||
            tag.id === EMarketCellData.TokenPrice ||
            tag.id === EMarketCellData.Token24hChange ||
            /* tag.id === EMarketCellData.Token24hVolume || */
            // 隐藏24hVolume
            tag.id === EMarketCellData.TokenMarketCap ||
            tag.id === EMarketCellData.TokenSparklineChart
          ) {
            const pressProps =
              tag.id === EMarketCellData.Token24hChange ||
              tag.id === EMarketCellData.CollectionStarOrSerialNumber ||
              tag.id === EMarketCellData.TokenInfo
                ? {
                    w:
                      isVertical && tag.id === EMarketCellData.Token24hChange
                        ? '100px'
                        : tag.minW,
                  }
                : { flex: 1 };
            const dislocationId = useDislocation
              ? tag.dislocation?.id ?? tag.id
              : tag.id;
            const dislocationTitle = useDislocation
              ? tag.dislocation?.title ?? tag.title
              : tag.title;
            return (
              <ListItem.Column key={`${tag.title ?? ''}--${tag.id}`}>
                <Pressable
                  onPress={() => {
                    let direction: 'up' | 'down' = 'down';
                    if (
                      listSort &&
                      listSort.id === dislocationId &&
                      listSort.direction === 'down'
                    ) {
                      direction = 'up';
                    }
                    backgroundApiProxy.serviceMarket.updateMarketListSort({
                      id: dislocationId,
                      direction,
                    });
                  }}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent={
                    tag.id === EMarketCellData.TokenInfo ||
                    tag.id === EMarketCellData.CollectionStarOrSerialNumber
                      ? 'flex-start'
                      : 'flex-end'
                  }
                  {...pressProps}
                >
                  <Typography.Subheading
                    color="text-subdued"
                    textAlign={tag?.textAlign}
                  >
                    {dislocationTitle
                      ? intl.formatMessage({
                          id: dislocationTitle,
                        })
                      : '#'}
                  </Typography.Subheading>
                  <Icon
                    name={
                      listSort &&
                      listSort.id === dislocationId &&
                      listSort.direction === 'up'
                        ? 'ChevronUpMini'
                        : 'ChevronDownMini'
                    }
                    size={16}
                    color={
                      listSort && listSort.id === dislocationId
                        ? 'icon-success'
                        : 'icon-subdued'
                    }
                  />
                </Pressable>
              </ListItem.Column>
            );
          }
          if (
            tag.id === EMarketCellData.TokenSwapStatus ||
            tag.id === EMarketCellData.TokenCollectionStarAndMore
          ) {
            return (
              <ListItem.Column key={`${tag.title ?? ''}--${tag.id}`}>
                <Box flex={1} />
              </ListItem.Column>
            );
          }
          return null;
        })}
      </ContainComponent>
      {!isVertical ? <Divider /> : null}
    </Box>
  );
};

export default memo(MarketListHeader);
