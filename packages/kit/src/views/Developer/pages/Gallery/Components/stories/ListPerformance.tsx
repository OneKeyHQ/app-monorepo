import { useCallback, useEffect, useRef, useState } from 'react';

import { useBenchmark } from '@shopify/flash-list';

import type { IListViewRef } from '@onekeyhq/components';
import {
  Button,
  Icon,
  ListItem,
  ListView,
  RefreshControl,
} from '@onekeyhq/components';
import HeaderButtonGroup from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderButtonGroup';

import useAppNavigation from '../../../../../../hooks/useAppNavigation';

import { NFTDATA } from './ListItem';

const NUMBEROFITEMS = 200;

const RELOADNFTDATA = new Array(NUMBEROFITEMS)
  .fill(null)
  .map((item, index) => NFTDATA[index % 3]);

const ITEMHEIGHT = 60;

const ListPerformance = () => {
  const [data, setData] = useState(RELOADNFTDATA);
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef<IListViewRef<any>>(null);
  const [onBlankArea] = useBenchmark(
    ref as any,
    (result) => {
      console.log(result);
      if (!result.interrupted) {
        alert(result.formattedString);
      }
    },
    { startDelayInMs: 0, speedMultiplier: 1 },
  );

  const navigation = useAppNavigation();

  const headerRight = useCallback(
    () => (
      <HeaderButtonGroup>
        <Button
          onPress={() => {
            ref?.current?.scrollToIndex({
              animated: true,
              index: NUMBEROFITEMS - 1,
            });
          }}
        >
          底部
        </Button>
        <Button
          onPress={() => {
            ref?.current?.scrollToIndex({
              animated: true,
              index: 0,
            });
          }}
        >
          顶部
        </Button>
      </HeaderButtonGroup>
    ),
    [],
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight,
    });
  }, [navigation, headerRight]);
  return (
    <ListView
      ref={ref}
      h={500}
      bg="$bgApp"
      data={data}
      estimatedItemSize={ITEMHEIGHT}
      getItemLayout={(item, index) => ({
        length: ITEMHEIGHT,
        offset: index * ITEMHEIGHT,
        index,
      })}
      onEndReached={() => {
        setTimeout(() => {
          setData([...data, ...data.splice(0, 10)]);
        }, 1000);
      }}
      onBlankArea={onBlankArea}
      viewabilityConfig={{
        waitForInteraction: true,
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 1000,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            setTimeout(() => {
              setRefreshing(false);
              const reversedData = [...data];
              reversedData.reverse();
              setData(reversedData);
            }, 500);
          }}
        />
      }
      renderItem={({
        item,
        index,
      }: {
        item: {
          title: string;
          subtitle: string;
          src: string;
          networkSrc?: string;
          amount?: string;
          value?: string;
        };
        index: number;
      }) => (
        <ListItem
          key={item.title}
          title={`${item.title}${index}`}
          subtitle={item.subtitle}
          maxWidth={600}
          width="95%"
          alignSelf="center"
          subtitleProps={{
            numberOfLines: 1,
          }}
          avatarProps={{
            src: item.src,
            fallbackProps: {
              bg: '$bgStrong',
              justifyContent: 'center',
              alignItems: 'center',
              children: <Icon name="ImageMountainSolid" />,
            },
            cornerImageProps: item.networkSrc
              ? { src: item.networkSrc }
              : undefined,
          }}
          onPress={() => {
            console.log('clicked');
          }}
        >
          <ListItem.Text
            align="right"
            primary={item.amount}
            secondary={item.value}
          />
        </ListItem>
      )}
    />
  );
};

export default ListPerformance;
