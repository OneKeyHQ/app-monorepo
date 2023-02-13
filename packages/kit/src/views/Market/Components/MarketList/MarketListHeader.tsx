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
  useUserDevice,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { EMarketCellData } from '../../config';
import { useListSort } from '../../hooks/useMarketList';

import type { ListHeadTagType } from '../../types';

interface MarketListHeaderProps {
  headTags: ListHeadTagType[];
}

const MarketListHeader: FC<MarketListHeaderProps> = ({ headTags }) => {
  const listSort = useListSort();
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const { size } = useUserDevice();
  const isNormalDevice = useMemo(() => ['NORMAL'].includes(size), [size]);
  const ContainComponent = useMemo(
    () => (isVertical ? Box : ListItem),
    [isVertical],
  );
  const useDislocation = useMemo(
    () => isVertical || isNormalDevice,
    [isNormalDevice, isVertical],
  );
  return (
    <Box mt="2" w="full">
      <ContainComponent flexDirection="row" px={2} py={1.5} my={0.5}>
        {headTags.map((tag) => {
          if (tag.id === EMarketCellData.CollectionStar) {
            return (
              <ListItem.Column
                key={tag.id}
                text={{
                  label: '#',
                  labelProps: {
                    typography: 'Subheading',
                    textAlign: tag.textAlign,
                    color: 'text-subdued',
                  },
                }}
                w={tag.minW}
              />
            );
          }
          if (
            tag.id === EMarketCellData.TokenInfo ||
            tag.id === EMarketCellData.TokenPrice ||
            tag.id === EMarketCellData.Token24hChange ||
            tag.id === EMarketCellData.Token24hVolume ||
            tag.id === EMarketCellData.TokenMarketCap ||
            tag.id === EMarketCellData.TokenSparklineChart
          ) {
            const pressProps =
              tag.id === EMarketCellData.Token24hChange
                ? { w: tag.minW }
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
                    tag.id === EMarketCellData.TokenInfo
                      ? 'flex-start'
                      : 'flex-end'
                  }
                  {...pressProps}
                >
                  <Typography.Subheading
                    color="text-subdued"
                    textAlign={tag.textAlign}
                  >
                    {intl.formatMessage({
                      id: dislocationTitle,
                    })}
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
          if (tag.id === EMarketCellData.TokenSwapStatus) {
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
