import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';

import {
  ListView,
  Page,
  ScrollView,
  Stack,
  Tab,
  Text,
} from '@onekeyhq/components';
import { getTokens } from '@onekeyhq/components/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import HeaderView from './HeaderView';

const FirstRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <ScrollView
    scrollEnabled={platformEnv.isWebTouchable}
    disableScrollViewPanResponder
    onContentSizeChange={onContentSizeChange}
  >
    <Stack bg="#ff4081" height="$100">
      <Text>demo1</Text>
    </Stack>
  </ScrollView>
);
const SecondRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <ListView
    data={new Array(70).fill({})}
    scrollEnabled={platformEnv.isWebTouchable}
    disableScrollViewPanResponder
    renderItem={({ index }) => (
      <Text color="$text" key={index}>
        demo2 ${index}
      </Text>
    )}
    estimatedItemSize={50}
    onContentSizeChange={onContentSizeChange}
  />
);

const OtherRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <ScrollView
    scrollEnabled={platformEnv.isWebTouchable}
    disableScrollViewPanResponder
    onContentSizeChange={onContentSizeChange}
  >
    <Stack bg="#ff4081" height="$100">
      <Text>demo3</Text>
    </Stack>
  </ScrollView>
);

const ListRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <ListView
    data={new Array(50).fill({})}
    scrollEnabled={platformEnv.isWebTouchable}
    disableScrollViewPanResponder
    renderItem={({ index }) => (
      <Stack style={{ padding: 20 }}>
        <Text>Row: {index}</Text>
      </Stack>
    )}
    estimatedItemSize={100}
    onContentSizeChange={onContentSizeChange}
  />
);

function HomePage() {
  const screenWidth = useWindowDimensions().width;
  const sideBarWidth = getTokens().size.sideBarWidth.val;
  const intl = useIntl();

  const onRefresh = useCallback(() => {
    // tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const data = useMemo(
    () => [
      {
        title: 'Label',
        page: memo(FirstRoute, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'action__default_chain',
        }),
        page: memo(SecondRoute, () => true),
      },
      {
        title: 'Label',
        page: memo(ListRoute, () => true),
      },
      {
        title: 'Label',
        page: memo(OtherRoute, () => true),
      },
    ],
    [intl],
  );

  const renderHeaderView = useCallback(() => <HeaderView />, []);

  return useMemo(
    () => (
      <Page>
        <Page.Body alignItems="center">
          <Tab
            // @ts-expect-error
            data={data}
            ListHeaderComponent={<>{renderHeaderView()}</>}
            initialScrollIndex={3}
            $md={{
              width: '100%',
            }}
            $gtMd={{
              width: screenWidth - sideBarWidth - 150,
            }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          />
        </Page.Body>
      </Page>
    ),
    [screenWidth, sideBarWidth, onRefresh, renderHeaderView, data],
  );
}

export default HomePage;
