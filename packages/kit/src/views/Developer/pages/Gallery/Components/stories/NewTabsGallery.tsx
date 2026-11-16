import { useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import { useHeaderHeight } from '@react-navigation/elements';
import { RefreshControl, View } from 'react-native';
import { CollapsiblePagerView, NativeScroller } from 'react-native-pager-view';

import { Button, Page, SizableText, Stack, XStack } from '@onekeyhq/components';
import { useHomeNativeListTheme } from '@onekeyhq/kit/src/views/Home/hooks/useHomeNativeListTheme';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

import type {
  NativeListSnapshot,
  RowModel,
} from '@onekeyfe/react-native-native-list';
import type { ViewInstance } from 'react-native';

// Reuse the public clip already used by Video.stories.tsx. Image decoding must
// fail before the native paused video preview can become visible.
const HOME_FIXTURE_VIDEO =
  'https://asset.onekey-asset.com/app-monorepo/bb7a4e71aba56b405faf9278776d57d73b829708/static/media/mydevice_hero_light.mp4';
const HOME_FIXTURE_IMAGE = {
  uri: 'https://uni.onekey-asset.com/static/chain/eth.png',
  width: 64,
  height: 64,
};

function HomeNativeListFixture({ onClose }: { onClose: () => void }) {
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const scrollerRef = useRef<ComponentRef<typeof NativeScroller>>(null);
  const scrollerMeasureRef = useRef<ViewInstance>(null);
  const headerHeight = useHeaderHeight();
  // This standalone fixture bypasses Layout's transparent navigation bar inset.
  const bodyPaddingTop = platformEnv.isNativeIOS26Plus ? headerHeight : 0;
  const theme = useHomeNativeListTheme();
  const [status, setStatus] = useState('Ready');
  const [table, setTable] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [columns, setColumns] = useState<2 | 6 | 7>(2);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const history = useMemo<NativeListSnapshot>(() => {
    const rows: RowModel[] = [
      {
        key: 'pending',
        sectionKey: 'pending',
        type: 'sectionHeader',
        title: 'Confirming',
        titleLoading: true,
        height: 40,
      },
      ...Array.from(
        { length: 10 },
        (_, index): RowModel => ({
          key: `activity-${index}`,
          testID: `home-native-fixture-activity-${index}`,
          type: 'activity',
          sectionKey: 'pending',
          leading: {
            kind: 'token',
            image: HOME_FIXTURE_IMAGE,
            networkImage: HOME_FIXTURE_IMAGE,
          },
          secondaryLeading: {
            kind: 'token',
            image: HOME_FIXTURE_IMAGE,
            networkImage: HOME_FIXTURE_IMAGE,
          },
          title:
            index === 0 ? 'Swap · pending actions' : `Multi-asset ${index}`,
          description: '14:30 • Public fixture recipient',
          descriptionActionKey: 'address-info',
          status: index === 0 ? 'Confirming' : 'Confirmed',
          presentation: table ? 'table' : 'stacked',
          badges: [
            { key: 'risk', text: 'Risk fixture', tone: 'warning' },
            { key: 'replacement', text: 'Replacement', tone: 'neutral' },
          ],
          amounts: Array.from(
            { length: index === 0 ? 2 : 6 },
            (unusedAmount, amount) => ({
              key: `amount-${amount}`,
              text: amount === 0 ? '-0.000001 ETH' : `+${amount} TOKEN`,
              tone: amount === 0 ? 'secondary' : 'positive',
              leading: { kind: 'token', image: HOME_FIXTURE_IMAGE },
              textSegments:
                amount === 0
                  ? [
                      { text: '-0.0' },
                      { text: '5', style: 'subscript' },
                      { text: '1 ETH' },
                    ]
                  : undefined,
              secondaryText: '$1.25',
            }),
          ),
          fee: table
            ? {
                label: 'Network fee',
                primary: '0.000001 ETH',
                primaryTextSegments: [
                  { text: '0.0' },
                  { text: '5', style: 'subscript' },
                  { text: '1 ETH' },
                ],
                secondary: '$0.01',
              }
            : undefined,
          footerActions:
            index === 0
              ? [
                  { key: 'speedup', label: 'Speed up', tone: 'primary' },
                  { key: 'cancel', label: 'Cancel', tone: 'danger' },
                  { key: 'check', label: 'Check status' },
                ]
              : undefined,
        }),
      ),
    ];
    return {
      schemaVersion: 1,
      generation: 1,
      theme,
      layout: { kind: 'sectioned', stickyHeaders: false },
      rows: empty ? [] : rows,
      capabilities: {
        pullToRefresh: true,
        refreshing,
        refreshTriggerDistance: 65,
      },
    };
  }, [theme, table, empty, refreshing]);
  const nfts = useMemo<NativeListSnapshot>(
    () => ({
      schemaVersion: 1,
      generation: 1,
      theme,
      layout: { kind: 'grid', gridColumns: columns },
      rows: Array.from(
        { length: 18 },
        (_, index): RowModel => ({
          key: `nft-${index}`,
          testID: `home-native-fixture-nft-${index}`,
          type: 'mediaTile',
          variant: 'gallery',
          title: index % 2 ? 'Image → video fallback' : 'Image preview',
          subtitle: `Public fixture #${index}`,
          networkImage: HOME_FIXTURE_IMAGE,
          badge: { key: 'quantity', text: '99+', tone: 'neutral' },
          media: {
            source:
              index % 2
                ? { uri: HOME_FIXTURE_VIDEO, width: 160, height: 160 }
                : HOME_FIXTURE_IMAGE,
            probeOrder: ['image', 'video'],
          },
        }),
      ),
    }),
    [theme, columns],
  );
  const chrome = (label: string) => (
    <Stack p="$3" bg="$bgSubdued">
      <SizableText>{label}</SizableText>
    </Stack>
  );
  return (
    <Page>
      <Page.Header title="Home NativeList acceptance" />
      <Page.Body pt={bodyPaddingTop}>
        <XStack px="$2" gap="$2" flexWrap="wrap">
          <Button
            testID="home-native-fixture-close"
            size="small"
            onPress={onClose}
          >
            Close
          </Button>
          <Button
            testID="home-native-fixture-layout"
            size="small"
            onPress={() => setTable((value) => !value)}
          >
            {table ? 'Table' : 'Stacked'}
          </Button>
          <Button
            testID="home-native-fixture-empty"
            size="small"
            onPress={() => setEmpty((value) => !value)}
          >
            {empty ? 'Restore rows' : 'Empty'}
          </Button>
          <Button
            testID="home-native-fixture-columns"
            size="small"
            onPress={() =>
              setColumns((value) => {
                if (value === 2) return 6;
                return value === 6 ? 7 : 2;
              })
            }
          >
            {columns} columns
          </Button>
          <Button
            testID="home-native-fixture-scroll-end"
            size="small"
            onPress={() => scrollerRef.current?.scrollToEnd({ animated: true })}
          >
            Scroll end
          </Button>
          <Button
            testID="home-native-fixture-measure"
            size="small"
            onPress={() =>
              scrollerMeasureRef.current?.measureInWindow(
                (_x, y, _width, height) =>
                  setStatus(`Anchor y=${y.toFixed(1)} h=${height.toFixed(1)}`),
              )
            }
          >
            Measure row
          </Button>
        </XStack>
        <SizableText px="$3" testID="home-native-fixture-status">
          {status} · refresh {refreshCount}
        </SizableText>
        {refreshing ? (
          <Button
            testID="home-native-fixture-refresh-finish"
            onPress={() => setRefreshing(false)}
          >
            Finish refresh
          </Button>
        ) : null}
        <CollapsiblePagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          nestedScrollEnabled
          nativeSmoothHeaderScrollEnabled
          pageRetentionDistance={2}
          offscreenPageLimit={1}
          headerHeight={64}
          stickyHeaderHeight={44}
          header={
            <View style={{ height: 64 }}>
              {chrome('Collapse this header; previews remain paused.')}
            </View>
          }
          stickyHeader={
            <XStack height={44} bg="$bgApp" gap="$2">
              <Button
                testID="home-native-fixture-history"
                onPress={() => pagerRef.current?.setPage(0)}
              >
                History
              </Button>
              <Button
                testID="home-native-fixture-nfts"
                onPress={() => pagerRef.current?.setPage(1)}
              >
                NFTs
              </Button>
              <Button
                testID="home-native-fixture-scroller"
                onPress={() => pagerRef.current?.setPageWithoutAnimation(2)}
              >
                Scroller
              </Button>
            </XStack>
          }
          onPageSelected={({ nativeEvent }) =>
            setStatus(`Page ${nativeEvent.position}`)
          }
        >
          <View key="history" collapsable={false} style={{ flex: 1 }}>
            <NativeList
              testID="home-native-fixture-history-list"
              style={{ flex: 1 }}
              snapshot={history}
              listHeader={chrome(
                'Scrolling notification / address selector slot',
              )}
              listEmpty={chrome('Empty History slot')}
              listFooter={chrome('Scrolling explorer footer slot')}
              scrollPositionThresholds={{ start: 48, end: 160 }}
              onScrollPositionThresholdChange={({ isBeyondThreshold }) =>
                setStatus(isBeyondThreshold ? 'Away from top' : 'Near top')
              }
              onRowAction={({ rowKey, actionKey, anchor }) =>
                setStatus(
                  `${rowKey}: ${actionKey} (${anchor?.source ?? 'row'})`,
                )
              }
              onRefresh={() => {
                setRefreshing(true);
                setRefreshCount((value) => value + 1);
              }}
            />
          </View>
          <View key="nfts" collapsable={false} style={{ flex: 1 }}>
            <NativeList
              testID="home-native-fixture-nft-list"
              style={{ flex: 1 }}
              snapshot={nfts}
              onRowAction={({ rowKey }) => setStatus(`Pressed ${rowKey}`)}
            />
          </View>
          <View key="scroller" collapsable={false} style={{ flex: 1 }}>
            <NativeScroller
              ref={scrollerRef}
              testID="home-native-fixture-scroller-content"
              pagerScrollKey="scroller"
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, flexGrow: 1 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    setRefreshCount((value) => value + 1);
                  }}
                />
              }
              onScrollBeginDrag={() => setStatus('Scroller drag')}
              onScrollEndDrag={() => setStatus('Scroller release')}
              onMomentumScrollBegin={() => setStatus('Scroller momentum')}
              onMomentumScrollEnd={() => setStatus('Scroller settled')}
            >
              {empty ? (
                <SizableText>Empty React content</SizableText>
              ) : (
                Array.from({ length: 24 }, (_, index) => (
                  <View
                    key={index}
                    ref={index === 23 ? scrollerMeasureRef : undefined}
                    collapsable={false}
                    testID={`home-native-fixture-scroller-anchor-${index}`}
                  >
                    <Button
                      testID={`home-native-fixture-scroller-row-${index}`}
                      height={64}
                      my="$1"
                      onPress={() => setStatus(`React row ${index}`)}
                    >
                      React row {index}
                    </Button>
                  </View>
                ))
              )}
            </NativeScroller>
          </View>
        </CollapsiblePagerView>
      </Page.Body>
    </Page>
  );
}

const NewTabsGallery = () => {
  const [showNativeFixture, setShowNativeFixture] = useState(false);
  if (platformEnv.isNative && showNativeFixture) {
    return (
      <HomeNativeListFixture onClose={() => setShowNativeFixture(false)} />
    );
  }
  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="NewTabs"
      elements={
        platformEnv.isNative
          ? [
              {
                title: 'Home native list acceptance',
                element: (
                  <Button
                    testID="home-native-fixture-open"
                    onPress={() => setShowNativeFixture(true)}
                  >
                    Open native list fixture
                  </Button>
                ),
              },
            ]
          : []
      }
    />
  );
};

export default NewTabsGallery;
