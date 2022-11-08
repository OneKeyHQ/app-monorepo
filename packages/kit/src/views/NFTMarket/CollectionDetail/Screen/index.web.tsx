import React, { ComponentProps, FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Pressable,
  Text,
  useThemeValue,
} from '@onekeyhq/components';

import { MAX_PAGE_CONTAINER_WIDTH } from '../../../../config';
import { HomeRoutes } from '../../../../routes/routesEnum';
import { HomeRoutesParams } from '../../../../routes/types';
import AssetsList from '../AssetsList';
import CollectionInfo from '../CollectionInfo';
import { useCollectionDetailContext } from '../context';
import TransactionList from '../TransactionList';
import { TabEnum } from '../type';

type TabBarProps = {
  items: { title: string; label: string }[];
  selectedIndex?: number;
  itemWidth?: string;
  onChange: (index: number) => void;
} & ComponentProps<typeof Box>;

const TabBar: FC<TabBarProps> = ({
  items,
  itemWidth,
  selectedIndex,
  onChange,
  ...ContainerProps
}) => {
  const activeColor = useThemeValue('text-default');
  const inactiveColor = useThemeValue('text-subdued');
  const indicatorColor = useThemeValue('action-primary-default');

  return (
    <Box flexDirection="row" {...ContainerProps}>
      {items.map((item, index) => {
        const isActive = index === selectedIndex;
        return (
          <Pressable
            alignItems="center"
            key={`${item.label}${index}`}
            width={itemWidth}
            onPress={() => {
              onChange(index);
            }}
          >
            <Box justifyContent="center" flexDirection="column" height="100%">
              <Box height="full">
                <Text
                  typography="Body2Strong"
                  textAlign="center"
                  color={isActive ? activeColor : inactiveColor}
                >
                  {item.title}
                </Text>
              </Box>
              {isActive ? (
                <Box width={itemWidth} height="2px" bgColor={indicatorColor} />
              ) : null}
            </Box>
          </Pressable>
        );
      })}
    </Box>
  );
};

const Screen = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<HomeRoutesParams, HomeRoutes.NFTMarketCollectionScreen>
    >();
  const { networkId, contractAddress } = route.params;
  const context = useCollectionDetailContext()?.context;
  const setContext = useCollectionDetailContext()?.setContext;

  return (
    <Box flexDirection="row" justifyContent="center" flex={1}>
      <Box
        width="full"
        height="full"
        flexDirection="column"
        maxW={MAX_PAGE_CONTAINER_WIDTH}
      >
        <CollectionInfo />
        <TabBar
          paddingX="51px"
          mt="32px"
          height="54px"
          itemWidth="54px"
          selectedIndex={context?.selectedIndex}
          onChange={(index) => {
            if (setContext) {
              setContext((ctx) => ({ ...ctx, selectedIndex: index }));
            }
          }}
          items={[
            {
              title: intl.formatMessage({ id: 'content__items' }),
              label: TabEnum.Items,
            },
            {
              title: intl.formatMessage({ id: 'content__sales' }),
              label: TabEnum.Sales,
            },
          ]}
        />
        <Box paddingX="51px">
          <Divider />
        </Box>
        <Box flex={1}>
          {context?.selectedIndex === 0 ? (
            <AssetsList
              contractAddress={contractAddress}
              networkId={networkId}
            />
          ) : (
            <TransactionList
              contractAddress={contractAddress}
              networkId={networkId}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Screen;
