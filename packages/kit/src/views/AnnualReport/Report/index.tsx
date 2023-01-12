import type { ComponentProps, FC } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import * as React from 'react';

import { useRoute } from '@react-navigation/core';
import { useWindowDimensions } from 'react-native';

import { Box, FlatList } from '@onekeyhq/components';

import { useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { Container, Footer, bgs, useHeaderHide } from '../components';
import { AnnualReportModal } from '../types';

import Identity, { Card, tags } from './Identity';
import NftList from './NftList';
import NftPNL from './NftPNL';
import PositionStyle from './PositionStyle';
import Rug from './Rug';
import Safe from './Safe';
import TotalAsset from './TotalAsset';

import type { HomeRoutes, HomeRoutesParams } from '../../../routes/types';
import type { AnnualReportModalParams, PageProps } from '../types';
import type { RouteProp } from '@react-navigation/core';
import type {
  ImageSourcePropType,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

type NavigationProps = RouteProp<HomeRoutesParams, HomeRoutes.AnnualReport>;

type DataItem = {
  bg: ImageSourcePropType;
  page: FC<PageProps>;
  containerProps?: ComponentProps<typeof Box>;
  filter?: (params: HomeRoutesParams['AnnualReport']) => boolean;
};

const defaultPages: DataItem[] = [
  {
    bg: bgs.bg1,
    page: TotalAsset,
  },
  {
    bg: bgs.bg2,
    page: PositionStyle,
    filter: (params) => !!params.tokens?.length,
  },
  {
    bg: bgs.bg3,
    page: NftPNL,
  },
  {
    bg: bgs.bg4,
    page: NftList,
  },
  {
    bg: bgs.bg5,
    page: Rug,
  },
  {
    bg: bgs.bg6,
    page: Safe,
  },
  {
    bg: bgs.bg7,
    page: Identity,
    containerProps: {
      px: 0,
    },
  },
];

const AnnualReport = () => {
  useHeaderHide();

  const navigation = useNavigation();
  const [currentPage, setCurrentPage] = useState(0);
  const selectCardRef = useRef<number>(0);
  const route = useRoute<NavigationProps>();
  const { width, height: winHeight } = useWindowDimensions();
  const [height, setHeight] = useState(() => winHeight);

  const pages = useMemo(
    () =>
      defaultPages.filter((p) => {
        if (!p.filter) {
          return true;
        }
        return p.filter(route.params);
      }),
    [route.params],
  );

  const onSelectedCardIndexChange = useCallback((index: number) => {
    selectCardRef.current = index;
  }, []);

  const renderItemContent = useCallback(
    ({
      item,
      shareMode = false,
      pageProps = {},
    }: {
      item: DataItem;
      shareMode?: boolean;
      pageProps?: Partial<PageProps>;
    }) => (
      <Box style={{ width, height }}>
        <Container
          bg={item.bg}
          shareMode={shareMode}
          containerProps={item.containerProps}
        >
          {React.createElement(item.page, {
            ...pageProps,
            params: route.params,
          })}
        </Container>
      </Box>
    ),
    [width, height, route?.params],
  );

  const handleShare = useCallback(() => {
    if (!pages[currentPage]) {
      return;
    }
    let params: AnnualReportModalParams['ShareModal'] = {
      page: renderItemContent({
        item: pages[currentPage],
        shareMode: true,
      }),
    };
    if (currentPage === pages.length - 1) {
      const card = tags[selectCardRef.current ?? 0];
      if (card) {
        params = {
          page: <Card {...card} name={route?.params?.name ?? ''} w={307} />,
          scale: false,
        };
      }
    }
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AnnualReport,
      params: {
        screen: AnnualReportModal.ShareModal,
        params,
      },
    });
  }, [route, navigation, renderItemContent, currentPage, pages]);

  const renderItem: ListRenderItem<DataItem> = useCallback(
    ({ item }) =>
      renderItemContent({
        item,
        pageProps: { onSelectedCardIndexChange },
      }),
    [renderItemContent, onSelectedCardIndexChange],
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = e.nativeEvent;
      const viewSize = e.nativeEvent.layoutMeasurement;
      setCurrentPage(Math.round(contentOffset.y / viewSize.height));
    },
    [],
  );

  return (
    <Box position="relative">
      <FlatList
        pagingEnabled
        data={pages}
        onLayout={(e) => {
          setHeight(e.nativeEvent.layout.height);
        }}
        onMomentumScrollEnd={handleScrollEnd}
        keyExtractor={(item) => String(item.page)}
        renderItem={renderItem}
      />
      <Footer
        onShare={handleShare}
        showIndicator={currentPage !== pages.length - 1}
      />
    </Box>
  );
};

export default AnnualReport;
