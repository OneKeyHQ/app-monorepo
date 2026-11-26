import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import {
  NativeList,
  planNativeListPatches,
} from '@onekeyfe/react-native-native-list';
import { useIntl } from 'react-intl';

import {
  ListEndIndicator,
  SizableText,
  Stack,
  useClipboard,
} from '@onekeyhq/components';
import { AppPagerContent } from '@onekeyhq/kit/src/components/AppPager/AppPagerContent';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useHomeNativeListTheme } from '@onekeyhq/kit/src/views/Home/hooks/useHomeNativeListTheme';
import { useMarketHolders } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketHolders';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMarketDetailIsFocusedTab } from '../../layout/MarketDetailScroll';

import { HoldersSkeleton } from './components/HoldersSkeleton';
import { useHoldersWidth } from './HoldersLayoutContext';
import { buildHolderRow, holderLayout, holderRowKey } from './holderTable';
import { useHoldersScrollHost } from './useHoldersScrollHost';

import type {
  NativeListRef,
  NativeListSnapshot,
  RowActionEvent,
} from '@onekeyfe/react-native-native-list';

interface IHoldersProps {
  tokenAddress: string;
  networkId: string;
  scrollEnabled?: boolean;
}

function HoldersBase({
  tokenAddress,
  networkId,
  scrollEnabled = true,
}: IHoldersProps) {
  const intl = useIntl();
  const theme = useHomeNativeListTheme();
  const { copyText } = useClipboard();
  const isTabFocused = useMarketDetailIsFocusedTab();
  const webHost = useHoldersScrollHost();
  const { holders, isRefreshing, isInitialPending } = useMarketHolders({
    tokenAddress,
    networkId,
    isTabFocused,
  });
  const { width, setWidth } = useHoldersWidth();
  const layout = useMemo(() => holderLayout(width), [width]);
  const actions = useMemo(
    () => [
      {
        name: 'Copy3Outline',
        actionKey: 'copy',
        accessibilityLabel: intl.formatMessage({
          id: ETranslations.global_copy_address,
        }),
      },
      {
        name: 'OpenOutline',
        actionKey: 'explorer',
        accessibilityLabel: intl.formatMessage({
          id: ETranslations.global_view_in_blockchain_explorer,
        }),
      },
    ],
    [intl],
  );
  const owner = `${networkId}:${tokenAddress}`;
  const snapshot = useMemo<NativeListSnapshot>(
    () => ({
      schemaVersion: 1,
      generation: 1,
      theme,
      layout: {
        kind: 'linear',
        contentPaddingBottom: platformEnv.isNativeAndroid ? 84 : 16,
      },
      rows: holders.map((holder, i) =>
        buildHolderRow(
          holder,
          i,
          networkId,
          layout,
          actions,
          theme.subduedBackground,
        ),
      ),
    }),
    [holders, networkId, layout, actions, theme],
  );
  const ref = useRef<NativeListRef>(null);
  const applied = useRef<
    | { owner: string; latest: NativeListSnapshot; base: NativeListSnapshot }
    | undefined
  >(undefined);
  const previous = applied.current;
  const patches =
    previous?.owner === owner
      ? planNativeListPatches(previous.latest, snapshot)
      : undefined;
  const base = patches && previous ? previous.base : snapshot;
  useLayoutEffect(() => {
    if (patches?.length) ref.current?.applyPatches(patches);
    applied.current = { owner, latest: snapshot, base };
  }, [base, patches, owner, snapshot]);
  const addresses = useMemo(
    () =>
      new Map(
        holders.map(({ accountAddress }) => [
          holderRowKey(networkId, accountAddress),
          accountAddress,
        ]),
      ),
    [holders, networkId],
  );
  const handleAction = useCallback(
    ({ rowKey, actionKey }: RowActionEvent) => {
      const address = rowKey && addresses.get(rowKey);
      if (!address) return;
      if (actionKey === 'copy') copyText(address);
      if (actionKey === 'explorer')
        void openExplorerAddressUrl({
          networkId,
          address,
          openInExternal: true,
        });
    },
    [addresses, copyText, networkId],
  );
  return (
    <AppPagerContent>
      <Stack
        flex={platformEnv.isNative ? 1 : undefined}
        pl={layout.wide ? 8 : 0}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        pointerEvents={scrollEnabled ? 'auto' : 'none'}
      >
        <NativeList
          key={owner}
          ref={ref}
          snapshot={base}
          style={platformEnv.isNative ? { flex: 1 } : { width: '100%' }}
          webScrollHost={isTabFocused ? webHost : null}
          onRowAction={handleAction}
          listFooter={
            !isRefreshing && holders.length ? <ListEndIndicator /> : undefined
          }
          listEmpty={
            isRefreshing || isInitialPending ? (
              <HoldersSkeleton layout={layout} />
            ) : (
              <Stack
                flex={1}
                alignItems="center"
                justifyContent="center"
                p="$8"
              >
                <SizableText size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.dexmarket_details_nodata,
                  })}
                </SizableText>
              </Stack>
            )
          }
        />
      </Stack>
    </AppPagerContent>
  );
}

export const Holders = memo(HoldersBase);
