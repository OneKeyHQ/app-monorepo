import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  ListItem,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { useListSort } from '../../hooks/useMarketList';
import { ListHeadTagType } from '../../types';

interface MarketListHeaderProps {
  headTags: ListHeadTagType[];
}

const MarketListHeader: FC<MarketListHeaderProps> = ({ headTags }) => {
  const listSort = useListSort();
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  return (
    <Box mt="2" w="full">
      <ListItem>
        {headTags.map((tag) => {
          if (tag.id === 1) {
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
            tag.id === 2 ||
            tag.id === 3 ||
            tag.id === 4 ||
            tag.id === 5 ||
            tag.id === 6 ||
            tag.id === 7
          ) {
            const pressProps = tag.id === 4 ? { w: tag.minW } : { flex: 1 };
            return (
              <ListItem.Column key={`${tag.title ?? ''}--${tag.id}`}>
                <Pressable
                  onPress={() => {
                    let direction: 'up' | 'down' = 'down';
                    if (
                      listSort &&
                      listSort.id === tag.id &&
                      listSort.direction === 'down'
                    ) {
                      direction = 'up';
                    }
                    backgroundApiProxy.serviceMarket.updateMarketListSort({
                      id: tag.id,
                      direction,
                    });
                  }}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent={tag.id === 2 ? 'flex-start' : 'flex-end'}
                  {...pressProps}
                >
                  <Typography.Subheading
                    color="text-subdued"
                    textAlign={tag.textAlign}
                  >
                    {intl.formatMessage({ id: tag.title })}
                  </Typography.Subheading>
                  <Icon
                    name={
                      listSort &&
                      listSort.id === tag.id &&
                      listSort.direction === 'up'
                        ? 'ChevronUpSolid'
                        : 'ChevronDownSolid'
                    }
                    size={16}
                    color={
                      listSort && listSort.id === tag.id
                        ? 'icon-success'
                        : 'icon-default'
                    }
                  />
                </Pressable>
              </ListItem.Column>
            );
          }
          if (tag.id === 8) {
            return (
              <ListItem.Column key={`${tag.title ?? ''}--${tag.id}`}>
                <Box flex={1} />
              </ListItem.Column>
            );
          }
          return null;
        })}
      </ListItem>
      {!isVertical ? <Divider /> : null}
    </Box>
  );
};

export default React.memo(MarketListHeader);
