import React, { ComponentProps, FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

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
}) => (
  <Box {...ContainerProps} w="100%" mt={{ base: '24px', md: '32px' }}>
    <Box
      h="1px"
      position="absolute"
      left={0}
      bottom={0}
      right={0}
      bgColor="divider"
    />
    <HStack space="32px">
      {items.map((item, index) => {
        const isActive = index === selectedIndex;
        return (
          <Pressable
            alignItems="center"
            pt="16px"
            pb="14px"
            borderBottomWidth={2}
            borderBottomColor={isActive ? 'interactive-default' : 'transparent'}
            key={`${item.label}${index}`}
            width={itemWidth}
            onPress={() => {
              onChange(index);
            }}
          >
            {({ isHovered, isPressed }) => (
              <Text
                typography="Body2Strong"
                textAlign="center"
                color={
                  isActive || isHovered || isPressed
                    ? 'text-default'
                    : 'text-subdued'
                }
              >
                {item.title}
              </Text>
            )}
          </Pressable>
        );
      })}
    </HStack>
  </Box>
);

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
        mb={{ md: '8px' }}
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
    <>
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
    </>
  );
};

export default Screen;
