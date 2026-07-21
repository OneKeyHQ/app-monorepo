import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import { EmptyDeFi } from '@onekeyhq/kit/src/components/Empty';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useDeFiListSlicedAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { useHomeResource } from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { buildProtocolDisplayInfo } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { useHomeDeFiIntents } from '../../model/react/homeDeFiIntents';
import { useHomeSectionPayload } from '../../model/react/homeStoreHooks';
import { RichBlock } from '../RichBlock/RichBlock';

import { shouldShowDeFiEmptyState } from './deFiListLoadingReducer';
import { DeFiListSkeleton } from './DeFiListSkeleton';
import { getOverviewCollapsedProtocolLimit } from './DeFiOverviewPlanner';
import { formatPortfolioTotal } from './formatPortfolioTotal';
import { buildDeFiOverviewCells } from './hooks/useDeFiOverviewTopN';
import { resolveOverviewCols } from './overviewColsResolver';
import { type IProtocolHandle, Protocol } from './Protocol';
import { useIsDeFiEnabled } from './useIsDeFiEnabled';

const MAX_PROTOCOLS_ON_SMALL_SCREEN = 6;
const PROTOCOL_LIST_TOGGLE_PRESS_LOCK_MS = 600;

function buildDeFiListOwnerKey({
  accountId,
  networkId,
}: {
  accountId?: string;
  networkId?: string;
}) {
  return accountId && networkId ? `${accountId}:${networkId}` : undefined;
}

function MobileProtocolDivider() {
  return (
    <YStack px="$5" py="$1.5">
      <Divider borderColor="$borderSubdued" />
    </YStack>
  );
}

export type IDeFiListBlockProps = {
  refreshCacheOnly?: boolean;
  tableLayout?: boolean;
  hideInternalTitle?: boolean;
  isDeFiEnabled?: boolean;
  registerProtocol?: (key: string, handle: IProtocolHandle | null) => void;
  onCollapseToProtocol?: (protocol: IDeFiProtocol) => void;
};

const ProtocolListItem = memo(
  ({
    accountId,
    indexedAccountId,
    isAllNetworks,
    isLast,
    onActionSuccess,
    protocol,
    protocolInfo,
    protocolKey,
    registerProtocol,
    supportedActions,
    tableLayout,
  }: {
    accountId?: string;
    indexedAccountId?: string;
    isAllNetworks?: boolean;
    isLast: boolean;
    onActionSuccess?: (
      params: IProtocolPositionActionSuccessParams,
    ) => void | Promise<void>;
    protocol: IDeFiProtocol;
    protocolInfo?: IProtocolSummary;
    protocolKey: string;
    registerProtocol?: (key: string, handle: IProtocolHandle | null) => void;
    supportedActions: IDeFiSupportedProtocolAction[];
    tableLayout?: boolean;
  }) => {
    const handleProtocolRef = useCallback(
      (handle: IProtocolHandle | null) =>
        registerProtocol?.(protocolKey, handle),
      [protocolKey, registerProtocol],
    );
    return (
      <YStack key={`${protocol.networkId}-${protocol.protocol}`}>
        <Protocol
          ref={registerProtocol ? handleProtocolRef : undefined}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          protocol={protocol}
          protocolInfo={protocolInfo}
          supportedActions={supportedActions}
          tableLayout={tableLayout}
          isAllNetworks={isAllNetworks}
          onActionSuccess={onActionSuccess}
        />
        {!tableLayout && !isLast ? <MobileProtocolDivider /> : null}
      </YStack>
    );
  },
);
ProtocolListItem.displayName = 'ProtocolListItem';

function DeFiListBlock({
  refreshCacheOnly = false,
  tableLayout,
  hideInternalTitle = false,
  isDeFiEnabled: isDeFiEnabledProp,
  registerProtocol,
  onCollapseToProtocol,
}: IDeFiListBlockProps) {
  const intl = useIntl();
  const media = useMedia();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const [isSliced, setIsSliced] = useDeFiListSlicedAtom();
  const { isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();
  const intents = useHomeDeFiIntents();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const resource = useHomeResource('defi');
  const payload = useHomeSectionPayload('defi');
  const computedIsDeFiEnabled = useIsDeFiEnabled(
    network?.id,
    isDeFiEnabledProp === undefined,
  );
  const isDeFiEnabled = isDeFiEnabledProp ?? computedIsDeFiEnabled;
  const protocols = useMemo(
    () => payload?.protocols ?? [],
    [payload?.protocols],
  );
  const protocolMap = useMemo(
    () => payload?.protocolMap ?? {},
    [payload?.protocolMap],
  );
  const supportedActions = useMemo(
    () => payload?.supportedActions ?? [],
    [payload?.supportedActions],
  );
  const initialized =
    resource.kind === 'ready' ||
    resource.kind === 'empty' ||
    resource.kind === 'error';
  const isRefreshing =
    resource.kind === 'idle' ||
    resource.kind === 'loading' ||
    ((resource.kind === 'ready' || resource.kind === 'empty') &&
      resource.refresh === 'refreshing');
  const currentOwnerKey = buildDeFiListOwnerKey({
    accountId: account?.id,
    networkId: network?.id,
  });

  useEffect(() => {
    if (!isHeaderRefreshing || refreshCacheOnly) {
      return;
    }
    void intents.refresh().finally(() => setIsHeaderRefreshing(false));
  }, [intents, isHeaderRefreshing, refreshCacheOnly, setIsHeaderRefreshing]);

  const overviewCols = resolveOverviewCols({
    gtXl: media.gtXl,
    gtLg: media.gtLg,
  });
  const maxProtocolsOnLargeScreen = getOverviewCollapsedProtocolLimit({
    cols: overviewCols,
    protocolCount: protocols.length,
  });
  const overflowThreshold = tableLayout
    ? maxProtocolsOnLargeScreen
    : MAX_PROTOCOLS_ON_SMALL_SCREEN;
  const isOverflow = protocols.length > overflowThreshold;
  const netWorth = useMemo(
    () =>
      Object.values(protocolMap)
        .reduce(
          (total, protocol) => total.plus(protocol.netWorth ?? 0),
          new BigNumber(0),
        )
        .toNumber(),
    [protocolMap],
  );
  const filteredProtocols = useMemo(() => {
    const sorted = buildDeFiOverviewCells(protocols, (protocol) => {
      const protocolInfo =
        protocolMap[
          defiUtils.buildProtocolMapKey({
            networkId: protocol.networkId,
            protocol: protocol.protocol,
          })
        ];
      const value = new BigNumber(
        buildProtocolDisplayInfo({ protocol, protocolInfo }).netWorth,
      );
      return value.isFinite() ? value.toNumber() : 0;
    }).map((cell) => cell.protocol);
    return isOverflow && isSliced ? sorted.slice(0, overflowThreshold) : sorted;
  }, [isOverflow, isSliced, overflowThreshold, protocolMap, protocols]);

  const protocolListLockUntilRef = useRef(0);
  const protocolListUnlockTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const [isProtocolListInteractionLocked, setIsProtocolListInteractionLocked] =
    useState(false);
  useEffect(
    () => () => {
      if (protocolListUnlockTimerRef.current) {
        clearTimeout(protocolListUnlockTimerRef.current);
      }
    },
    [],
  );
  const handleToggleSliced = useCallback(() => {
    if (protocolListLockUntilRef.current > Date.now()) {
      return;
    }
    const targetProtocol = isSliced
      ? undefined
      : filteredProtocols[
          Math.min(overflowThreshold, filteredProtocols.length) - 1
        ];
    protocolListLockUntilRef.current =
      Date.now() + PROTOCOL_LIST_TOGGLE_PRESS_LOCK_MS;
    setIsProtocolListInteractionLocked(true);
    if (protocolListUnlockTimerRef.current) {
      clearTimeout(protocolListUnlockTimerRef.current);
    }
    protocolListUnlockTimerRef.current = setTimeout(() => {
      setIsProtocolListInteractionLocked(false);
    }, PROTOCOL_LIST_TOGGLE_PRESS_LOCK_MS);
    setIsSliced(!isSliced);
    if (targetProtocol) {
      onCollapseToProtocol?.(targetProtocol);
    }
  }, [
    filteredProtocols,
    isSliced,
    onCollapseToProtocol,
    overflowThreshold,
    setIsSliced,
  ]);

  if (refreshCacheOnly || !isDeFiEnabled) {
    return null;
  }

  const subtitle =
    !initialized && isRefreshing ? (
      <Skeleton.HeadingXl w={120} />
    ) : (
      <SizableText
        size="$headingXl"
        color={tableLayout ? '$textSubdued' : '$text'}
      >
        {formatPortfolioTotal(
          netWorth,
          settings.currencyInfo.symbol,
          settingsValue.hideValue,
        )}
      </SizableText>
    );
  const shouldShowEmpty = shouldShowDeFiEmptyState({
    protocolsLength: protocols.length,
    initialized,
    isRefreshing,
    ownerKey: currentOwnerKey,
    loadedOwnerKey: initialized ? currentOwnerKey : undefined,
  });
  const title = hideInternalTitle
    ? undefined
    : intl.formatMessage({ id: ETranslations.global_earn });
  const emptyContent = shouldShowEmpty ? (
    <EmptyDeFi tableLayout={tableLayout} />
  ) : (
    <DeFiListSkeleton tableLayout={tableLayout} />
  );

  return (
    <RichBlock
      withTitleSeparator
      title={title}
      subTitle={hideInternalTitle ? undefined : subtitle}
      subTitleProps={tableLayout ? undefined : { color: '$text' }}
      headerContainerProps={{ px: '$pagePadding' }}
      contentContainerProps={tableLayout ? { px: '$pagePadding' } : undefined}
      plainContentContainer
      content={
        protocols.length === 0 ? (
          emptyContent
        ) : (
          <>
            <YStack
              gap={tableLayout ? '$5' : '$0'}
              pt={tableLayout ? '$0' : '$1'}
              flex={1}
              pointerEvents={
                isProtocolListInteractionLocked ? 'none' : undefined
              }
            >
              {filteredProtocols.map((protocol, index) => {
                const protocolKey = defiUtils.buildProtocolMapKey({
                  networkId: protocol.networkId,
                  protocol: protocol.protocol,
                });
                return (
                  <ProtocolListItem
                    key={protocolKey}
                    accountId={account?.id}
                    indexedAccountId={account?.indexedAccountId}
                    isAllNetworks={network?.isAllNetworks}
                    isLast={index === filteredProtocols.length - 1}
                    onActionSuccess={intents.onPositionActionSucceeded}
                    protocol={protocol}
                    protocolInfo={protocolMap[protocolKey]}
                    protocolKey={protocolKey}
                    registerProtocol={registerProtocol}
                    supportedActions={supportedActions}
                    tableLayout={tableLayout}
                  />
                );
              })}
            </YStack>
            {isOverflow ? (
              <XStack
                alignItems="center"
                justifyContent="center"
                pt="$4"
                px="$pagePadding"
              >
                <Button
                  testID="home-render-content-btn"
                  size="small"
                  variant="secondary"
                  disabled={isProtocolListInteractionLocked}
                  onPress={handleToggleSliced}
                  $md={
                    {
                      flexGrow: 1,
                      flexBasis: 0,
                      size: 'medium',
                      borderRadius: '$full',
                    } as never
                  }
                >
                  {intl.formatMessage({
                    id: isSliced
                      ? ETranslations.global_show_more
                      : ETranslations.global_show_less,
                  })}
                </Button>
              </XStack>
            ) : null}
          </>
        )
      }
    />
  );
}

export { DeFiListBlock };
