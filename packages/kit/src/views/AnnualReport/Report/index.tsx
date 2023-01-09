import type { ComponentProps, FC } from 'react';
import * as React from 'react';
import { useCallback, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useWindowDimensions } from 'react-native';

import { Box, FlatList } from '@onekeyhq/components';
import bg1 from '@onekeyhq/kit/assets/annual/2.png';
import bg2 from '@onekeyhq/kit/assets/annual/3.png';
import bg3 from '@onekeyhq/kit/assets/annual/4.png';
import bg4 from '@onekeyhq/kit/assets/annual/5.png';
import bg5 from '@onekeyhq/kit/assets/annual/6.png';
import bg6 from '@onekeyhq/kit/assets/annual/7.png';

import { useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { Container, useHeaderHide } from '../components';
import { AnnualReportModal } from '../types';

import AnnualPage1 from './Page1';
import AnnualPage2 from './Page2';
import AnnualPage3 from './Page3';
import AnnualPage4 from './Page4';
import AnnualPage5 from './Page5';
import AnnualPage6 from './Page6';
import AnnualPage7 from './Page7';

import type { HomeRoutes, HomeRoutesParams } from '../../../routes/types';
import type { PageProps } from '../types';
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
  showIndicator?: boolean;
};

const pages: DataItem[] = [
  {
    bg: bg1,
    page: AnnualPage1,
  },
  {
    bg: bg2,
    page: AnnualPage2,
  },
  {
    bg: bg3,
    page: AnnualPage3,
  },
  {
    bg: bg4,
    page: AnnualPage4,
  },
  {
    bg: bg5,
    page: AnnualPage5,
  },
  {
    bg: bg6,
    page: AnnualPage6,
  },
  {
    bg: bg2,
    page: AnnualPage7,
    containerProps: {
      px: 0,
    },
    showIndicator: false,
  },
];

const AnnualReport = () => {
  useHeaderHide();

  const navigation = useNavigation();
  const currentPage = useRef<number>(0);
  const selectCardRef = useRef<number>(0);
  const route = useRoute<NavigationProps>();
  const { width, height: winHeight } = useWindowDimensions();
  const [height, setHeight] = useState(() => winHeight);

  const onSelectedCardIndexChange = useCallback((index: number) => {
    selectCardRef.current = index;
  }, []);

  const renderItemContent = useCallback(
    ({
      item,
      onShare,
      showHeader = true,
      renderShareFooter = false,
      pageProps = {},
    }: {
      item: DataItem;
      onShare?: () => void;
      showHeader?: boolean;
      renderShareFooter?: boolean;
      pageProps?: Partial<PageProps>;
    }) => (
      <Box style={{ width, height }}>
        <Container
          bg={item.bg}
          onShare={onShare}
          showHeader={showHeader}
          containerProps={item.containerProps}
          showHeaderLogo={false}
          showIndicator={item.showIndicator}
          renderShareFooter={renderShareFooter}
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
    const index = currentPage.current;
    if (!pages[index]) {
      return;
    }
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AnnualReport,
      params: {
        screen: AnnualReportModal.ShareModal,
        params: {
          page: renderItemContent({
            item: pages[index],
            showHeader: false,
            renderShareFooter: true,
            pageProps: { selectedCardIndex: selectCardRef.current ?? 0 },
          }),
        },
      },
    });
  }, [navigation, renderItemContent]);

  const renderItem: ListRenderItem<DataItem> = useCallback(
    ({ item }) =>
      renderItemContent({
        item,
        onShare: handleShare,
        pageProps: { onSelectedCardIndexChange },
      }),
    [handleShare, renderItemContent, onSelectedCardIndexChange],
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = e.nativeEvent;
      const viewSize = e.nativeEvent.layoutMeasurement;
      const pageNum = Math.floor(contentOffset.y / viewSize.height);
      currentPage.current = pageNum;
    },
    [],
  );

  return (
    <FlatList
      pagingEnabled
      data={pages}
      onMomentumScrollEnd={handleScrollEnd}
      keyExtractor={(item) => String(item.bg)}
      onLayout={(e) => {
        setHeight(e.nativeEvent.layout.height);
      }}
      renderItem={renderItem}
    />
  );
};

export default AnnualReport;
