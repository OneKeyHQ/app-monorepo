import { useCallback, useMemo, useState } from 'react';

import {
  Stack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { ProviderJotaiContextDeFiList } from '../../../states/jotai/contexts/deFiList';
import useActiveTabDAppInfo from '../../DAppConnection/hooks/useActiveTabDAppInfo';
import { DeFiListBlock } from '../components/DeFiListBlock';
import { DustSweepHintScope } from '../components/DustSweepBanner/DustSweepBanner';
import { HomeScrollView } from '../components/HomeScrollView';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { TokenListBlock } from '../components/TokenListBlock';

import { HOME_PAGE_DOCKED_CONTENT_MAX_WIDTH } from './homePageContentMaxWidth';

import type { LayoutChangeEvent } from 'react-native';

// Visual max-width for the wallet page main content. Has to match the
// `regular` layout previously applied at the Page.Container level so the page
// doesn't suddenly widen when the page-level constraint was removed (see
// HomePageView's `homePageContentMaxWidthSx` and the comment there).
const PORTFOLIO_CONTENT_MAX_WIDTH = 1140;

function PortfolioContainer({ bottomPadding }: { bottomPadding: number }) {
  const media = useMedia();

  const [nativeContentWidth, setNativeContentWidth] = useState(0);
  const handleNativeLayout = useCallback((event: LayoutChangeEvent) => {
    setNativeContentWidth(event.nativeEvent.layout.width);
  }, []);
  // Tablet media queries describe the navigation pane, not this list's viewport.
  const tableLayout = platformEnv.isNative
    ? nativeContentWidth >= 768
    : media.gtMd;

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  // Nothing shows under the token list on any platform; Market and Earn
  // have their own pages. The DeFi block only keeps the DeFi tab's cache
  // fresh.
  const otherBlocks = <DeFiListBlock refreshCacheOnly />;

  if (platformEnv.isNative) {
    return (
      <Stack flex={1} onLayout={handleNativeLayout}>
        <DustSweepHintScope>
          <TokenListBlock
            tableLayout={tableLayout || undefined}
            nativeListFooter={
              <Stack gap="$6" width="100%" paddingBottom={bottomPadding}>
                <YStack
                  flex={1}
                  gap={tableLayout ? '$10' : '$6'}
                  pb={tableLayout ? '$8' : '$4'}
                >
                  {otherBlocks}
                  {tableLayout && addPaddingOnListFooter ? (
                    <Stack h="$16" />
                  ) : null}
                </YStack>
                {!tableLayout && addPaddingOnListFooter ? (
                  <Stack h="$16" />
                ) : null}
              </Stack>
            }
          />
        </DustSweepHintScope>
      </Stack>
    );
  }

  // Use a stable tree structure (Stack > YStack > children) regardless of
  // layout mode so that TokenListBlock is never unmounted/remounted when the
  // viewport crosses the mobile/desktop breakpoint.  Remounting resets the
  // All-Networks loading state while the page is "unfocused" (modal open),
  // which causes the token list to be stuck in a loading state.
  return (
    <DustSweepHintScope>
      <Stack
        flexDirection={tableLayout ? 'row' : 'column'}
        pt="$3"
        gap="$6"
        width="100%"
        $gtMd={{ maxWidth: PORTFOLIO_CONTENT_MAX_WIDTH, mx: 'auto' }}
        $gtXl={{ maxWidth: HOME_PAGE_DOCKED_CONTENT_MAX_WIDTH }}
      >
        <YStack
          flex={1}
          gap={tableLayout ? '$10' : '$6'}
          pb={tableLayout ? '$8' : '$4'}
        >
          <TokenListBlock tableLayout={tableLayout || undefined} />
          {otherBlocks}
        </YStack>
        {addPaddingOnListFooter ? <Stack h="$16" /> : null}
      </Stack>
    </DustSweepHintScope>
  );
}

function PortfolioContainerWithProvider() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const tabBarHeight = useScrollContentTabBarOffset();
  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <ProviderJotaiContextDeFiList>
        {platformEnv.isNative ? (
          <PortfolioContainer bottomPadding={tabBarHeight ?? 0} />
        ) : (
          <HomeScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: tabBarHeight }}
            nestedScrollEnabled={platformEnv.isNativeAndroid}
            refreshControl={
              !platformEnv.isNativeAndroid ? (
                <PullToRefresh onRefresh={onHomePageRefresh} />
              ) : undefined
            }
          >
            <PortfolioContainer bottomPadding={tabBarHeight ?? 0} />
          </HomeScrollView>
        )}
      </ProviderJotaiContextDeFiList>
    </HomeTokenListProviderMirrorWrapper>
  );
}
PortfolioContainerWithProvider.displayName = 'PortfolioContainerWithProvider';

export { PortfolioContainerWithProvider };
