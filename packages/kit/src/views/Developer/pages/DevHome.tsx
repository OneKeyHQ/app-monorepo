import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Icon,
  Image,
  ListView,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  Tab,
  XStack,
} from '@onekeyhq/components';
import { getTokens } from '@onekeyhq/components/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EAccountManagerStacksRoutes } from '../../AccountManagerStacks/router/types';

import HeaderView from './HeaderView';

import type { ITabHomeParamList } from '../../Home/router';

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
      <SizableText>demo1</SizableText>
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
      <SizableText color="$text" key={index}>
        demo2 ${index}
      </SizableText>
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
      <SizableText>demo3</SizableText>
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
        <SizableText>Row: {index}</SizableText>
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

  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();

  const navigateAccountManagerStacks = useCallback(() => {
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.AccountSelectorStack,
    });
  }, [navigation]);

  return useMemo(
    () => (
      <Page>
        <Page.Header
          headerTitle={() => (
            <XStack
              role="button"
              alignItems="center"
              p="$1.5"
              mx="$-1.5"
              borderRadius="$2"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              onPress={navigateAccountManagerStacks}
              maxWidth="$40"
            >
              <Image size="$6" borderRadius="$1">
                <Image.Source src="https://placehold.co/120x120?text=A" />
                <Image.Fallback>
                  <Skeleton w="$6" h="$6" />
                </Image.Fallback>
              </Image>
              <SizableText
                flex={1}
                size="$bodyMdMedium"
                pl="$2"
                pr="$1"
                numberOfLines={1}
              >
                Account 1
              </SizableText>
              <Icon
                name="ChevronGrabberVerOutline"
                size="$5"
                color="$iconSubdued"
              />
            </XStack>
          )}
        />
        <Page.Body alignItems="center">
          <Tab
            // @ts-expect-error
            data={data}
            ListHeaderComponent={<>{renderHeaderView()}</>}
            initialScrollIndex={3}
            stickyHeaderIndices={[1]}
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
    [
      data,
      renderHeaderView,
      screenWidth,
      sideBarWidth,
      onRefresh,
      navigateAccountManagerStacks,
    ],
  );
}

export default HomePage;
