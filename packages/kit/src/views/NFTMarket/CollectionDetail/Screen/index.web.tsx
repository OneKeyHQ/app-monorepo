import React, { ComponentProps, FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Pressable,
  Text,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';

import { MAX_PAGE_CONTAINER_WIDTH } from '../../../../config';
import { HomeRoutes } from '../../../../routes/routesEnum';
import { HomeRoutesParams } from '../../../../routes/types';
import AssetsList from '../AssetsList';
import CollectionInfo from '../CollectionInfo';
import { useCollectionDetailContext } from '../context';
import TransactionList, {
  ListHeader as TransactionListHeader,
} from '../TransactionList';
import { TabEnum } from '../type';

const MemoCollectionInfo = React.memo(CollectionInfo);

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
                <Center height="full">
                  <Text
                    typography="Body2Strong"
                    textAlign="center"
                    color={isActive ? activeColor : inactiveColor}
                  >
                    {item.title}
                  </Text>
                </Center>
                {isActive ? (
                  <Box height="2px" bgColor={indicatorColor} />
                ) : null}
              </Box>
            </Box>
          </Pressable>
        );
      })}
    </Box>
  );
};

const AssetHeader = () => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();

  const context = useCollectionDetailContext()?.context;
  const setContext = useCollectionDetailContext()?.setContext;
  return (
    <Box flexDirection="column" alignItems="flex-start">
      <MemoCollectionInfo />
      <TabBar
        mb={isSmallScreen ? '24px' : '32px'}
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
    </Box>
  );
};

const TransactionHeader = () => {
  const intl = useIntl();
  const context = useCollectionDetailContext()?.context;
  const setContext = useCollectionDetailContext()?.setContext;
  return (
    <Box flexDirection="column" alignItems="flex-start">
      <MemoCollectionInfo />
      <TabBar
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
      <TransactionListHeader />
    </Box>
  );
};

const Screen = () => {
  const route =
    useRoute<
      RouteProp<HomeRoutesParams, HomeRoutes.NFTMarketCollectionScreen>
    >();
  const { networkId, contractAddress } = route.params;
  const context = useCollectionDetailContext()?.context;

  return (
    <Box flexDirection="row" justifyContent="center" flex={1}>
      <Box
        width="full"
        height="full"
        flexDirection="column"
        maxW={MAX_PAGE_CONTAINER_WIDTH}
      >
        {context?.selectedIndex === 0 ? (
          <AssetsList
            contractAddress={contractAddress}
            networkId={networkId}
            ListHeaderComponent={() => <AssetHeader />}
          />
        ) : (
          <TransactionList
            contractAddress={contractAddress}
            networkId={networkId}
            ListHeaderComponent={() => <TransactionHeader />}
          />
        )}
      </Box>
    </Box>
  );
};

export default Screen;
