import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IListViewRef, IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Empty,
  HeaderButtonGroup,
  Icon,
  IconButton,
  ListView,
  Page,
  Progress,
  SearchBar,
  SizableText,
  Spinner,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { logCustomInjectedClientError } from '@onekeyhq/kit/src/utils/customInjectedClientOperationLog';
import {
  createCustomInjectedProtocolFilterRows,
  filterCustomInjectedProtocolRows,
  getCustomInjectedProtocolListFilter,
  setCustomInjectedProtocolListFilter,
} from '@onekeyhq/kit/src/utils/customInjectedProtocolListFilterRuntime';
import type {
  ICustomInjectedProtocolFilterRow,
  ICustomInjectedProtocolListFilter,
} from '@onekeyhq/kit/src/utils/customInjectedProtocolListFilterRuntime';
import {
  acquireCustomInjectedProtocolSelectionLock,
  getActiveCustomInjectedProtocolRuntime,
  isCustomInjectedProtocolRuntimeActive,
  waitForCustomInjectedProtocolRuntimeReady,
} from '@onekeyhq/kit/src/utils/customInjectedProtocolRuntime';
import {
  getActiveCustomInjectedWorkspace,
  requestCustomInjectedProtocolSelection,
  setActiveCustomInjectedWorkspace,
  subscribeActiveCustomInjectedWorkspace,
} from '@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime';
import type {
  ECustomInjectedModalRoutes,
  ICustomInjectedModalParamList,
} from '@onekeyhq/kit/src/views/Discovery/router/customInjectedModalRoutes';
import type {
  ICustomInjectedE2EWorkflowSummary,
  ICustomInjectedSession,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  CustomInjectedE2EStatusIcon,
  CustomInjectedE2EStatusIcons,
  type ICustomInjectedE2EStatusKey,
  getCustomInjectedE2EStatusDescription,
} from '../../components/CustomInjectedE2EStatusIcons';
import { CustomInjectedProtocolSourceIcon } from '../../components/CustomInjectedProtocolSourceIcon';
import {
  CUSTOM_INJECTED_REVIEW_STATE_CONFIG,
  CUSTOM_INJECTED_REVIEW_STATE_ORDER,
  type ICustomInjectedReviewState,
} from '../../components/CustomInjectedReviewStatus';

import type { RouteProp } from '@react-navigation/core';

export { resetCustomInjectedProtocolListFilter as resetCustomInjectedProtocolListFilterMemory } from '@onekeyhq/kit/src/utils/customInjectedProtocolListFilterRuntime';

const PROTOCOL_ROW_HEIGHT = 72;
const STATUS_COLUMN_WIDTH = 52;
const E2E_COLUMN_WIDTH = 140;

const compactUsd = new Intl.NumberFormat('en', {
  currency: 'USD',
  maximumFractionDigits: 1,
  notation: 'compact',
  style: 'currency',
});

const integer = new Intl.NumberFormat('en');

const E2E_FILTER_OPTIONS: {
  label: string;
  value: ICustomInjectedE2EStatusKey;
}[] = [
  { label: 'Recorded', value: 'recorded' },
  { label: 'Generated', value: 'generated' },
  { label: 'Validated', value: 'validated' },
  { label: 'Adapter', value: 'adapter' },
];

type IStatusFilter = ICustomInjectedProtocolListFilter['statusFilter'];
type ISourceFilter = ICustomInjectedProtocolListFilter['sourceFilter'];
type IE2EFilter = ICustomInjectedProtocolListFilter['e2eFilter'];

function getProtocolSourceLabel(source: string) {
  if (source === 'defillama') return 'DeFiLlama';
  if (source === 'custom') return 'Custom';
  return source;
}

function getInitialSession(sessionId: string) {
  const session = getActiveCustomInjectedWorkspace();
  return session?.sessionId === sessionId ? session : undefined;
}

export default function CustomInjectedProtocolListModal() {
  const navigation = useAppNavigation<IPageNavigationProp<ICustomInjectedModalParamList>>();
  const route =
    useRoute<RouteProp<ICustomInjectedModalParamList, ECustomInjectedModalRoutes.ProtocolList>>();
  const { selectedProtocolId, sessionId } = route.params;
  const [session, setSession] = useState<ICustomInjectedSession | undefined>(() =>
    getInitialSession(sessionId),
  );
  const [loadError, setLoadError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [actionStatus, setActionStatus] = useState<{
    tone: 'critical' | 'success';
    text: string;
  }>();
  const [searchValue, setSearchValue] = useState(
    () => getCustomInjectedProtocolListFilter().searchValue,
  );
  const deferredSearchValue = useDeferredValue(searchValue);
  const [sourceFilter, setSourceFilter] = useState<ISourceFilter>(
    () => getCustomInjectedProtocolListFilter().sourceFilter,
  );
  const [statusFilter, setStatusFilter] = useState<IStatusFilter>(
    () => getCustomInjectedProtocolListFilter().statusFilter,
  );
  const [e2eFilter, setE2EFilter] = useState<IE2EFilter>(
    () => getCustomInjectedProtocolListFilter().e2eFilter,
  );
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);
  const [selectedProtocolKey, setSelectedProtocolKey] = useState(selectedProtocolId);
  const [e2eStates, setE2EStates] = useState<Record<string, ICustomInjectedE2EWorkflowSummary>>({});
  const [e2eBatchProgress, setE2EBatchProgress] = useState<{
    current: number;
    total: number;
  }>();
  const e2eBatchRunningRef = useRef(false);
  const listRef = useRef<IListViewRef<ICustomInjectedProtocolFilterRow> | null>(null);
  const locateAfterFilterResetRef = useRef(false);

  useEffect(() => {
    setCustomInjectedProtocolListFilter({
      searchValue,
      sourceFilter,
      statusFilter,
      e2eFilter,
    });
  }, [e2eFilter, searchValue, sourceFilter, statusFilter]);

  useEffect(
    () =>
      subscribeActiveCustomInjectedWorkspace((nextSession) => {
        if (!nextSession || nextSession.sessionId === sessionId) {
          setSession(nextSession);
        }
      }),
    [sessionId],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [nextSession, nextE2EStates] = await Promise.all([
          globalThis.desktopApiProxy.webview.getCustomInjectedWorkspace(sessionId),
          globalThis.desktopApiProxy.webview
            .getCustomInjectedE2EStates(sessionId)
            .catch(() => ({})),
        ]);
        if (cancelled) return;
        setLoadError(undefined);
        setSession(nextSession);
        setE2EStates(nextE2EStates);
        setActiveCustomInjectedWorkspace(nextSession);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt, sessionId]);

  const rows = useMemo(
    () => createCustomInjectedProtocolFilterRows(session?.protocols ?? []),
    [session?.protocols],
  );

  const sourceCounts = useMemo(
    () =>
      rows.reduce<Record<string, number>>((counts, { protocol }) => {
        counts[protocol.source] = (counts[protocol.source] ?? 0) + 1;
        return counts;
      }, {}),
    [rows],
  );

  const sourceRows = useMemo(
    () =>
      !sourceFilter.length
        ? rows
        : rows.filter(({ protocol }) => sourceFilter.includes(protocol.source)),
    [rows, sourceFilter],
  );

  const statusCounts = useMemo(
    () =>
      sourceRows.reduce(
        (counts, { protocol }) => {
          counts[protocol.manualReview.state] += 1;
          return counts;
        },
        { pending: 0, processed: 0, unsupported: 0 },
      ),
    [sourceRows],
  );

  const reviewFilteredRows = useMemo(
    () =>
      !statusFilter.length
        ? sourceRows
        : sourceRows.filter(({ protocol }) => statusFilter.includes(protocol.manualReview.state)),
    [sourceRows, statusFilter],
  );

  const e2eCounts = useMemo(
    () =>
      E2E_FILTER_OPTIONS.reduce<Record<ICustomInjectedE2EStatusKey, number>>(
        (counts, option) => {
          counts[option.value] = reviewFilteredRows.filter(({ protocol }) =>
            Boolean(e2eStates[protocol.key]?.[option.value]),
          ).length;
          return counts;
        },
        { adapter: 0, generated: 0, recorded: 0, validated: 0 },
      ),
    [e2eStates, reviewFilteredRows],
  );

  const filteredRows = useMemo(
    () =>
      filterCustomInjectedProtocolRows({
        rows,
        filter: {
          searchValue: deferredSearchValue,
          sourceFilter,
          statusFilter,
          e2eFilter,
        },
        e2eStates,
      }),
    [deferredSearchValue, e2eFilter, e2eStates, rows, sourceFilter, statusFilter],
  );

  const completedCount = statusCounts.processed + statusCounts.unsupported;
  const completionPercentage = sourceRows.length
    ? Math.round((completedCount / sourceRows.length) * 100)
    : 0;
  const hasActiveFilters = Boolean(
    deferredSearchValue.trim() ||
    sourceFilter.length ||
    statusFilter.length ||
    Object.keys(e2eFilter).length,
  );
  const activeFacetCount =
    sourceFilter.length + statusFilter.length + Object.keys(e2eFilter).length;

  const toggleSourceFilter = useCallback((source: string) => {
    setSourceFilter((current) =>
      current.includes(source) ? current.filter((value) => value !== source) : [...current, source],
    );
  }, []);

  const toggleStatusFilter = useCallback((status: ICustomInjectedReviewState) => {
    setStatusFilter((current) =>
      current.includes(status) ? current.filter((value) => value !== status) : [...current, status],
    );
  }, []);

  const toggleE2EFilter = useCallback((status: ICustomInjectedE2EStatusKey) => {
    setE2EFilter((current) => {
      const next = { ...current };
      if (!current[status]) {
        next[status] = 'included';
      } else if (current[status] === 'included') {
        next[status] = 'excluded';
      } else {
        delete next[status];
      }
      return next;
    });
  }, []);

  const currentIndex = useMemo(
    () => filteredRows.findIndex(({ protocol }) => protocol.key === selectedProtocolKey),
    [filteredRows, selectedProtocolKey],
  );

  const scrollToCurrent = useCallback(() => {
    if (currentIndex < 0) return;
    listRef.current?.scrollToIndex({
      animated: true,
      index: currentIndex,
      viewPosition: 0.5,
    });
  }, [currentIndex]);

  useEffect(() => {
    if (!locateAfterFilterResetRef.current) return;
    locateAfterFilterResetRef.current = false;
    const timeout = setTimeout(scrollToCurrent, 0);
    return () => clearTimeout(timeout);
  }, [filteredRows, scrollToCurrent]);

  const locateCurrent = useCallback(() => {
    if (
      searchValue ||
      sourceFilter.length ||
      statusFilter.length ||
      Object.keys(e2eFilter).length
    ) {
      locateAfterFilterResetRef.current = true;
      setSearchValue('');
      setSourceFilter([]);
      setStatusFilter([]);
      setE2EFilter({});
      return;
    }
    scrollToCurrent();
  }, [e2eFilter, scrollToCurrent, searchValue, sourceFilter, statusFilter]);

  const clearFilters = useCallback(() => {
    setSearchValue('');
    setSourceFilter([]);
    setStatusFilter([]);
    setE2EFilter({});
  }, []);

  const selectFilteredRow = useCallback(
    (index: number) => {
      if (e2eBatchRunningRef.current) return;
      const row = filteredRows[index];
      if (!row || !session) return;
      setSelectedProtocolKey(row.protocol.key);
      requestCustomInjectedProtocolSelection(row.protocol, session);
      listRef.current?.scrollToIndex({
        animated: true,
        index,
        viewPosition: 0.5,
      });
    },
    [filteredRows, session],
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ animated: true, offset: 0 });
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!filteredRows.length) return;
    listRef.current?.scrollToIndex({
      animated: true,
      index: filteredRows.length - 1,
      viewPosition: 1,
    });
  }, [filteredRows.length]);

  const retryLoad = useCallback(() => {
    setLoadError(undefined);
    setLoadAttempt((value) => value + 1);
  }, []);

  const refreshProtocols = useCallback(async () => {
    setRefreshing(true);
    try {
      const next =
        await globalThis.desktopApiProxy.webview.refreshCustomInjectedProtocols(sessionId);
      const nextE2EStates = await globalThis.desktopApiProxy.webview
        .getCustomInjectedE2EStates(sessionId)
        .catch(() => ({}));
      setSession(next);
      setE2EStates(nextE2EStates);
      setActiveCustomInjectedWorkspace(next);
      setActionStatus({
        tone: 'success',
        text: `${String(next.protocols.length)} protocols refreshed and sorted by TVL`,
      });
    } catch (error) {
      setActionStatus({
        tone: 'critical',
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRefreshing(false);
    }
  }, [sessionId]);

  const pendingE2EProtocols = useMemo(
    () =>
      (session?.protocols ?? []).filter((protocol) => {
        const state = e2eStates[protocol.key];
        return state?.generated && !state.validated;
      }),
    [e2eStates, session?.protocols],
  );

  const validatePendingE2Es = useCallback(async () => {
    if (!session || e2eBatchRunningRef.current || !pendingE2EProtocols.length) return;
    e2eBatchRunningRef.current = true;
    const candidates = [...pendingE2EProtocols];
    const originalScope = getActiveCustomInjectedProtocolRuntime();
    const originalProtocolId =
      originalScope?.sessionId === sessionId ? originalScope.protocolId : undefined;
    let selectionLock: ReturnType<typeof acquireCustomInjectedProtocolSelectionLock> | undefined;
    let passed = 0;
    let failed = 0;
    let firstFailure: string | undefined;
    try {
      selectionLock = acquireCustomInjectedProtocolSelectionLock({
        reason: 'pending E2E validation',
        sessionId,
      });
      for (const [index, protocol] of candidates.entries()) {
        setE2EBatchProgress({ current: index + 1, total: candidates.length });
        try {
          const latestSession =
            await globalThis.desktopApiProxy.webview.getCustomInjectedWorkspace(sessionId);
          const latestProtocol = latestSession.protocols.find(
            (candidate) => candidate.key === protocol.key,
          );
          if (!latestProtocol) {
            throw new OneKeyLocalError('Custom injection protocol not found');
          }
          const pendingSession =
            await globalThis.desktopApiProxy.webview.updateCustomInjectedProtocol({
              action: 'set-review',
              sessionId,
              protocolId: latestProtocol.key,
              expectedRegistrySha256: latestProtocol.registrySha256,
              state: 'pending',
            });
          const pendingProtocol = pendingSession.protocols.find(
            (candidate) => candidate.key === protocol.key,
          );
          if (!pendingProtocol) {
            throw new OneKeyLocalError('Custom injection protocol not found');
          }
          setSession(pendingSession);
          setActiveCustomInjectedWorkspace(pendingSession);
          setSelectedProtocolKey(pendingProtocol.key);
          const runtimeScope = requestCustomInjectedProtocolSelection(
            pendingProtocol,
            pendingSession,
            { lockToken: selectionLock.token },
          );
          if (!runtimeScope) {
            throw new OneKeyLocalError('Unable to create an isolated protocol runtime');
          }
          const ready = await waitForCustomInjectedProtocolRuntimeReady(runtimeScope);
          if (!ready || !isCustomInjectedProtocolRuntimeActive(runtimeScope)) {
            throw new OneKeyLocalError(
              'The protocol page was replaced before E2E validation started',
            );
          }
          const outcome = await globalThis.desktopApiProxy.webview.runCustomInjectedE2E(
            sessionId,
            protocol.key,
          );
          if (!outcome.ok) {
            failed += 1;
            firstFailure ??= `${protocol.name}: ${outcome.error}`;
          } else {
            if (outcome.result.passed) {
              passed += 1;
            } else {
              failed += 1;
            }
            setE2EStates((current) => ({
              ...current,
              [protocol.key]: {
                ...(current[protocol.key] ?? {
                  adapter: false,
                  generated: true,
                  recorded: true,
                  resultPresent: false,
                  validated: false,
                }),
                resultPresent: true,
                validated: outcome.result.passed,
              },
            }));
          }
        } catch (error) {
          failed += 1;
          logCustomInjectedClientError({
            sessionId,
            protocolId: protocol.key,
            operation: 'e2e.batch.validate',
            input: { current: index + 1, total: candidates.length },
            error,
          });
          firstFailure ??= `${protocol.name}: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }
      const nextE2EStates = await globalThis.desktopApiProxy.webview
        .getCustomInjectedE2EStates(sessionId)
        .catch(() => undefined);
      if (nextE2EStates) {
        setE2EStates(nextE2EStates);
      }
      const summary = `${String(candidates.length)} E2E validations finished · ${String(
        passed,
      )} passed · ${String(failed)} failed`;
      setActionStatus({
        tone: failed ? 'critical' : 'success',
        text: firstFailure ? `${summary} · ${firstFailure}` : summary,
      });
    } catch (error) {
      logCustomInjectedClientError({
        sessionId,
        operation: 'e2e.batch.validate',
        error,
      });
      setActionStatus({
        tone: 'critical',
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (
        selectionLock &&
        originalScope &&
        originalProtocolId &&
        !isCustomInjectedProtocolRuntimeActive(originalScope)
      ) {
        try {
          const latestSession =
            await globalThis.desktopApiProxy.webview.getCustomInjectedWorkspace(sessionId);
          const originalProtocol = latestSession.protocols.find(
            (protocol) => protocol.key === originalProtocolId,
          );
          if (originalProtocol) {
            setSession(latestSession);
            setActiveCustomInjectedWorkspace(latestSession);
            setSelectedProtocolKey(originalProtocol.key);
            const restoredScope = requestCustomInjectedProtocolSelection(
              originalProtocol,
              latestSession,
              { lockToken: selectionLock.token },
            );
            if (!restoredScope) {
              logCustomInjectedClientError({
                sessionId,
                protocolId: originalProtocol.key,
                operation: 'e2e.runtime.restore',
                error:
                  'E2E validation finished, but the original protocol runtime could not be restored',
              });
              setActionStatus({
                tone: 'critical',
                text: 'E2E validation finished, but the original protocol runtime could not be restored',
              });
            } else {
              const restoredReady = await waitForCustomInjectedProtocolRuntimeReady(restoredScope);
              if (!restoredReady || !isCustomInjectedProtocolRuntimeActive(restoredScope)) {
                logCustomInjectedClientError({
                  sessionId,
                  protocolId: originalProtocol.key,
                  operation: 'e2e.runtime.restore',
                  error:
                    'E2E validation finished, but the original protocol page did not become ready',
                });
                setActionStatus({
                  tone: 'critical',
                  text: 'E2E validation finished, but the original protocol page did not become ready',
                });
              }
            }
          }
        } catch (error) {
          logCustomInjectedClientError({
            sessionId,
            protocolId: originalProtocolId,
            operation: 'e2e.runtime.restore',
            error,
          });
          setActionStatus({
            tone: 'critical',
            text: `E2E validation finished, but the original protocol could not be restored: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      }
      selectionLock?.release();
      e2eBatchRunningRef.current = false;
      setE2EBatchProgress(undefined);
    }
  }, [pendingE2EProtocols, session, sessionId]);

  const renderItem = useCallback(
    ({ item }: { item: ICustomInjectedProtocolFilterRow }) => {
      const { position, protocol } = item;
      const isCurrent = protocol.key === selectedProtocolKey;
      const e2eState = e2eStates[protocol.key];
      const reviewStatusConfig = CUSTOM_INJECTED_REVIEW_STATE_CONFIG[protocol.manualReview.state];
      return (
        <XStack
          aria-current={isCurrent ? 'true' : undefined}
          alignItems="center"
          backgroundColor={isCurrent ? '$bgInfoSubdued' : undefined}
          borderBottomColor="$borderSubdued"
          borderBottomWidth={1}
          borderLeftColor={isCurrent ? '$borderInfo' : 'transparent'}
          borderLeftWidth={3}
          cursor="pointer"
          focusable
          focusVisibleStyle={{
            outlineColor: '$focusRing',
            outlineOffset: -2,
            outlineStyle: 'solid',
            outlineWidth: 2,
          }}
          gap="$3"
          height={PROTOCOL_ROW_HEIGHT}
          hoverStyle={{ bg: isCurrent ? '$bgInfo' : '$bgHover' }}
          px="$4"
          pressStyle={{ bg: isCurrent ? '$bgInfo' : '$bgActive' }}
          role="button"
          testID={`custom-injected-protocol-${protocol.source}-${protocol.id}`}
          userSelect="none"
          onPress={() => {
            if (!session || e2eBatchRunningRef.current) return;
            requestCustomInjectedProtocolSelection(protocol, session);
            navigation.pop();
          }}
        >
          <XStack alignItems="center" gap="$1" width={48}>
            <XStack flexShrink={0} width="$4">
              {isCurrent ? (
                <Tooltip
                  renderContent="Current protocol"
                  renderTrigger={
                    <XStack
                      alignItems="center"
                      aria-label="Current protocol"
                      justifyContent="center"
                      role="img"
                      testID={`custom-injected-protocol-current-${protocol.source}-${protocol.id}`}
                    >
                      <Icon color="$iconInfo" name="TargetCircleSolid" size="$3.5" />
                    </XStack>
                  }
                />
              ) : null}
            </XStack>
            <SizableText
              color="$textSubdued"
              flex={1}
              size="$bodySm"
              textAlign="right"
              testID={`custom-injected-protocol-sequence-${protocol.source}-${protocol.id}`}
            >
              {String(position)}
            </SizableText>
          </XStack>
          <YStack flex={1} gap="$0.5" minWidth={0}>
            <XStack alignItems="center" gap="$1.5">
              <SizableText flexShrink={1} numberOfLines={1} size="$bodyMdMedium">
                {protocol.name}
              </SizableText>
              <Tooltip
                renderContent={`Source: ${getProtocolSourceLabel(protocol.source)}`}
                renderTrigger={
                  <CustomInjectedProtocolSourceIcon
                    source={protocol.source}
                    size={14}
                    testID={`custom-injected-protocol-source-${protocol.source}-${protocol.id}`}
                  />
                }
              />
            </XStack>
            <XStack alignItems="center" gap="$1.5">
              <SizableText color="$textSubdued" flexShrink={1} numberOfLines={1} size="$bodySm">
                {protocol.url}
              </SizableText>
              {protocol.urlSource === 'override' ? (
                <Tooltip
                  renderContent="URL override"
                  renderTrigger={
                    <XStack
                      alignItems="center"
                      aria-label="URL override"
                      justifyContent="center"
                      role="img"
                      testID={`custom-injected-protocol-override-${protocol.source}-${protocol.id}`}
                    >
                      <Icon color="$iconInfo" name="LayerBehindOutline" size="$3.5" />
                    </XStack>
                  }
                />
              ) : null}
            </XStack>
          </YStack>
          <SizableText color="$textSubdued" size="$bodySmMedium" textAlign="right" width={88}>
            {compactUsd.format(protocol.totalTvl)}
          </SizableText>
          <XStack justifyContent="flex-end" width={STATUS_COLUMN_WIDTH}>
            <Tooltip
              renderContent={`Status: ${reviewStatusConfig.label}`}
              renderTrigger={
                <XStack
                  alignItems="center"
                  aria-label={`Status: ${reviewStatusConfig.label}`}
                  backgroundColor={reviewStatusConfig.backgroundColor}
                  borderRadius="$2"
                  h="$7"
                  justifyContent="center"
                  role="img"
                  testID={`custom-injected-protocol-status-${protocol.source}-${protocol.id}`}
                  w="$7"
                >
                  <Icon
                    color={reviewStatusConfig.iconColor}
                    name={reviewStatusConfig.icon}
                    size="$4"
                  />
                </XStack>
              }
            />
          </XStack>
          <XStack justifyContent="flex-end" width={E2E_COLUMN_WIDTH}>
            <CustomInjectedE2EStatusIcons
              adapter={Boolean(e2eState?.adapter)}
              generated={Boolean(e2eState?.generated)}
              recorded={Boolean(e2eState?.recorded)}
              testID={`custom-injected-protocol-e2e-${protocol.source}-${protocol.id}`}
              validated={Boolean(e2eState?.validated)}
            />
          </XStack>
          <Tooltip
            renderContent="Open protocol"
            renderTrigger={
              <XStack
                alignItems="center"
                aria-label="Open protocol"
                justifyContent="center"
                role="img"
              >
                <Icon color="$iconSubdued" name="ChevronRightSmallOutline" size="$4" />
              </XStack>
            }
          />
        </XStack>
      );
    },
    [e2eStates, navigation, selectedProtocolKey, session],
  );

  const headerRight = useCallback(
    () => (
      <HeaderButtonGroup gap="$2">
        <SearchBar
          containerProps={{ width: 240 }}
          placeholder="Search sequence #, name, URL, slug, or ID"
          size="small"
          testID="custom-injected-protocol-search"
          value={searchValue}
          onSearchTextChange={setSearchValue}
        />
        <Button
          aria-expanded={isFilterPanelExpanded}
          backgroundColor={activeFacetCount ? '$bgInfoSubdued' : '$bgStrong'}
          borderColor={activeFacetCount ? '$borderInfo' : '$transparent'}
          childrenAsText={false}
          h="$7"
          icon="Filter2Outline"
          iconColor={activeFacetCount ? '$iconInfo' : '$icon'}
          iconAfter={isFilterPanelExpanded ? 'ChevronUpSmallOutline' : 'ChevronDownSmallOutline'}
          px="$2"
          py="$0"
          size="small"
          testID="custom-injected-filter-panel-toggle"
          variant="secondary"
          onPress={() => setIsFilterPanelExpanded((expanded) => !expanded)}
        >
          <SizableText color={activeFacetCount ? '$textInfo' : '$text'} size="$bodySmMedium">
            {activeFacetCount ? `Filters · ${String(activeFacetCount)}` : 'Filters'}
          </SizableText>
        </Button>
        <IconButton
          aria-label="Refresh protocols"
          disabled={refreshing || Boolean(e2eBatchProgress)}
          icon="RefreshCwOutline"
          loading={refreshing}
          testID="custom-injected-refresh-protocols"
          title="Refresh protocols"
          variant="tertiary"
          onPress={() => {
            void refreshProtocols();
          }}
        />
      </HeaderButtonGroup>
    ),
    [
      activeFacetCount,
      e2eBatchProgress,
      isFilterPanelExpanded,
      refreshProtocols,
      refreshing,
      searchValue,
    ],
  );

  const validatePendingE2ELabel = e2eBatchProgress
    ? `Validating ${String(e2eBatchProgress.current)} / ${String(e2eBatchProgress.total)}`
    : `Validate pending E2E (${String(pendingE2EProtocols.length)})`;

  const initialScrollIndex = rows.findIndex(({ protocol }) => protocol.key === selectedProtocolKey);

  return (
    <Page lazyLoad>
      <Page.Header title="All protocols" headerRight={headerRight} />
      <Page.Body>
        <YStack gap="$3" px="$4" pb="$3">
          {isFilterPanelExpanded ? (
            <YStack
              backgroundColor="$bgSubdued"
              borderColor="$borderSubdued"
              borderRadius="$2"
              borderWidth={1}
              gap="$1.5"
              p="$2"
              testID="custom-injected-filter-panel"
            >
              <XStack alignItems="center" gap="$1.5" minHeight="$6">
                <SizableText color="$textSubdued" flexShrink={0} size="$bodyXsMedium" width={64}>
                  Source
                </SizableText>
                <XStack flex={1} flexWrap="wrap" gap="$1">
                  <Button
                    aria-pressed={!sourceFilter.length}
                    backgroundColor={!sourceFilter.length ? '$bgInfoSubdued' : '$bgStrong'}
                    borderColor={!sourceFilter.length ? '$borderInfo' : '$transparent'}
                    childrenAsText={false}
                    h="$6"
                    px="$1.5"
                    py="$0"
                    size="small"
                    testID="custom-injected-source-all"
                    variant="secondary"
                    onPress={() => setSourceFilter([])}
                  >
                    <SizableText
                      color={!sourceFilter.length ? '$textInfo' : '$textSubdued'}
                      size="$bodyXsMedium"
                    >
                      {`All ${integer.format(rows.length)}`}
                    </SizableText>
                  </Button>
                  {(session?.sources ?? Object.keys(sourceCounts))
                    .filter((source) => Boolean(sourceCounts[source]))
                    .map((source) => {
                      const isActive = sourceFilter.includes(source);
                      return (
                        <Button
                          key={source}
                          aria-pressed={isActive}
                          backgroundColor={isActive ? '$bgInfoSubdued' : '$bgStrong'}
                          borderColor={isActive ? '$borderInfo' : '$transparent'}
                          childrenAsText={false}
                          h="$6"
                          px="$1.5"
                          py="$0"
                          size="small"
                          testID={`custom-injected-source-${source}`}
                          variant="secondary"
                          onPress={() => toggleSourceFilter(source)}
                        >
                          <XStack alignItems="center" gap="$1">
                            <CustomInjectedProtocolSourceIcon
                              active={isActive}
                              source={source}
                              size={14}
                              testID={`custom-injected-source-${source}-icon`}
                            />
                            <SizableText
                              color={isActive ? '$textInfo' : '$textSubdued'}
                              size="$bodyXsMedium"
                            >
                              {`${getProtocolSourceLabel(
                                source,
                              )} ${integer.format(sourceCounts[source] ?? 0)}`}
                            </SizableText>
                          </XStack>
                        </Button>
                      );
                    })}
                </XStack>
                <IconButton
                  aria-label="Clear all filters"
                  disabled={!activeFacetCount}
                  h="$6"
                  icon="XCircleOutline"
                  iconSize="$4"
                  size="small"
                  testID="custom-injected-filter-panel-clear"
                  title="Clear all filters"
                  variant="tertiary"
                  w="$6"
                  onPress={() => {
                    setSourceFilter([]);
                    setStatusFilter([]);
                    setE2EFilter({});
                  }}
                />
              </XStack>
              <XStack
                alignItems="center"
                gap="$1.5"
                minHeight="$6"
                testID="custom-injected-status-filters"
              >
                <SizableText color="$textSubdued" flexShrink={0} size="$bodyXsMedium" width={64}>
                  Status
                </SizableText>
                <XStack flex={1} flexWrap="wrap" gap="$1">
                  <Button
                    aria-pressed={!statusFilter.length}
                    backgroundColor={!statusFilter.length ? '$bgInfoSubdued' : '$bgStrong'}
                    borderColor={!statusFilter.length ? '$borderInfo' : '$transparent'}
                    childrenAsText={false}
                    h="$6"
                    px="$1.5"
                    py="$0"
                    size="small"
                    testID="custom-injected-filter-all"
                    variant="secondary"
                    onPress={() => setStatusFilter([])}
                  >
                    <SizableText
                      color={!statusFilter.length ? '$textInfo' : '$textSubdued'}
                      size="$bodyXsMedium"
                    >
                      {`All ${integer.format(sourceRows.length)}`}
                    </SizableText>
                  </Button>
                  {CUSTOM_INJECTED_REVIEW_STATE_ORDER.map((state) => {
                    const config = CUSTOM_INJECTED_REVIEW_STATE_CONFIG[state];
                    const isActive = statusFilter.includes(state);
                    return (
                      <Button
                        key={state}
                        aria-pressed={isActive}
                        backgroundColor={isActive ? config.backgroundColor : '$bgStrong'}
                        borderColor={isActive ? '$borderInfo' : '$transparent'}
                        childrenAsText={false}
                        h="$6"
                        px="$1.5"
                        py="$0"
                        size="small"
                        testID={`custom-injected-filter-${state}`}
                        variant="secondary"
                        onPress={() => toggleStatusFilter(state)}
                      >
                        <XStack alignItems="center" gap="$1">
                          <Icon color={config.iconColor} name={config.icon} size="$3" />
                          <SizableText
                            color={isActive ? config.textColor : '$textSubdued'}
                            size="$bodyXsMedium"
                          >
                            {`${config.label} ${integer.format(statusCounts[state])}`}
                          </SizableText>
                        </XStack>
                      </Button>
                    );
                  })}
                </XStack>
                <XStack flexShrink={0} width="$6" />
              </XStack>
              <XStack
                alignItems="center"
                gap="$1.5"
                minHeight="$6"
                testID="custom-injected-e2e-filters"
              >
                <SizableText color="$textSubdued" flexShrink={0} size="$bodyXsMedium" width={64}>
                  E2E ±
                </SizableText>
                <XStack flex={1} flexWrap="wrap" gap="$1">
                  <Button
                    aria-pressed={!Object.keys(e2eFilter).length}
                    backgroundColor={
                      !Object.keys(e2eFilter).length ? '$bgInfoSubdued' : '$bgStrong'
                    }
                    borderColor={!Object.keys(e2eFilter).length ? '$borderInfo' : '$transparent'}
                    childrenAsText={false}
                    h="$6"
                    px="$1.5"
                    py="$0"
                    size="small"
                    testID="custom-injected-e2e-filter-all"
                    variant="secondary"
                    onPress={() => setE2EFilter({})}
                  >
                    <SizableText
                      color={!Object.keys(e2eFilter).length ? '$textInfo' : '$textSubdued'}
                      size="$bodyXsMedium"
                    >
                      Any
                    </SizableText>
                  </Button>
                  {E2E_FILTER_OPTIONS.map((option) => {
                    const filterValue = e2eFilter[option.value];
                    const isIncluded = filterValue === 'included';
                    const isExcluded = filterValue === 'excluded';
                    const matchingCount = isExcluded
                      ? reviewFilteredRows.length - e2eCounts[option.value]
                      : e2eCounts[option.value];
                    let filterLabel = option.label;
                    let filterDescription = 'not filtered';
                    let filterBackgroundColor: '$bgCritical' | '$bgInfoSubdued' | '$bgStrong' =
                      '$bgStrong';
                    let filterBorderColor: '$borderCritical' | '$borderInfo' | '$transparent' =
                      '$transparent';
                    let filterTextColor: '$textCritical' | '$textInfo' | '$textSubdued' =
                      '$textSubdued';
                    if (isIncluded) {
                      filterLabel = `+ ${option.label}`;
                      filterDescription = 'must be complete';
                      filterBackgroundColor = '$bgInfoSubdued';
                      filterBorderColor = '$borderInfo';
                      filterTextColor = '$textInfo';
                    } else if (isExcluded) {
                      filterLabel = `− ${option.label}`;
                      filterDescription = 'must be incomplete';
                      filterBackgroundColor = '$bgCritical';
                      filterBorderColor = '$borderCritical';
                      filterTextColor = '$textCritical';
                    }
                    let filterTooltip = `${getCustomInjectedE2EStatusDescription(
                      option.value,
                    )} Not used as a filter. Click to require it.`;
                    if (isIncluded) {
                      filterTooltip = `${getCustomInjectedE2EStatusDescription(
                        option.value,
                      )} Showing only protocols that have it. Click to require it to be missing.`;
                    } else if (isExcluded) {
                      filterTooltip = `${getCustomInjectedE2EStatusDescription(
                        option.value,
                      )} Showing only protocols that do not have it. Click to stop filtering.`;
                    }
                    return (
                      <Tooltip
                        key={option.value}
                        renderContent={filterTooltip}
                        renderTrigger={
                          <Button
                            aria-label={`${option.label}: ${filterDescription}`}
                            aria-pressed={Boolean(filterValue)}
                            backgroundColor={filterBackgroundColor}
                            borderColor={filterBorderColor}
                            childrenAsText={false}
                            h="$6"
                            px="$1"
                            py="$0"
                            size="small"
                            testID={`custom-injected-e2e-filter-${option.value}`}
                            variant="secondary"
                            onPress={() => toggleE2EFilter(option.value)}
                          >
                            <XStack alignItems="center" gap="$1">
                              <CustomInjectedE2EStatusIcon
                                active={!isExcluded}
                                compact
                                showTooltip={false}
                                status={option.value}
                              />
                              <SizableText color={filterTextColor} size="$bodyXsMedium">
                                {`${filterLabel} ${integer.format(matchingCount)}`}
                              </SizableText>
                            </XStack>
                          </Button>
                        }
                      />
                    );
                  })}
                </XStack>
                <XStack flexShrink={0} width="$6" />
              </XStack>
            </YStack>
          ) : null}
          <YStack gap="$1.5">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText color="$textSubdued" size="$bodySmMedium">
                Review progress
              </SizableText>
              <SizableText color="$textSubdued" size="$bodySm">
                {`${integer.format(completedCount)} / ${integer.format(
                  sourceRows.length,
                )} · ${String(completionPercentage)}%`}
              </SizableText>
            </XStack>
            <Progress
              animated={false}
              indicatorColor="$bgSuccessStrong"
              value={completionPercentage}
            />
          </YStack>
        </YStack>
        {actionStatus ? (
          <SizableText
            color={actionStatus.tone === 'critical' ? '$textCritical' : '$textSuccess'}
            numberOfLines={2}
            size="$bodySm"
            testID="custom-injected-protocol-action-status"
          >
            {actionStatus.text}
          </SizableText>
        ) : null}
        {!session && !loadError ? (
          <YStack alignItems="center" flex={1} justifyContent="center">
            <Spinner size="large" />
          </YStack>
        ) : null}
        {loadError ? (
          <Empty
            flex={1}
            icon="ListSearchOutline"
            title="Unable to load protocols"
            description={loadError}
            buttonProps={{
              children: 'Try again',
              testID: 'custom-injected-retry-load',
              onPress: retryLoad,
            }}
          />
        ) : null}
        {session && !loadError ? (
          <YStack flex={1}>
            <XStack
              alignItems="center"
              backgroundColor="$bgSubdued"
              borderBottomColor="$borderSubdued"
              borderBottomWidth={1}
              borderLeftColor="transparent"
              borderLeftWidth={3}
              gap="$3"
              height={36}
              px="$4"
            >
              <SizableText color="$textSubdued" size="$bodyXsMedium" textAlign="right" width={48}>
                #
              </SizableText>
              <SizableText color="$textSubdued" flex={1} size="$bodyXsMedium">
                {hasActiveFilters
                  ? `Protocol · ${integer.format(filteredRows.length)} of ${integer.format(
                      rows.length,
                    )}`
                  : `Protocol · ${integer.format(rows.length)}`}
              </SizableText>
              <SizableText color="$textSubdued" size="$bodyXsMedium" textAlign="right" width={88}>
                TVL ↓
              </SizableText>
              <SizableText
                color="$textSubdued"
                size="$bodyXsMedium"
                textAlign="right"
                width={STATUS_COLUMN_WIDTH}
              >
                Status
              </SizableText>
              <SizableText
                color="$textSubdued"
                size="$bodyXsMedium"
                textAlign="right"
                width={E2E_COLUMN_WIDTH}
              >
                E2E
              </SizableText>
              <XStack width="$4" />
            </XStack>
            <ListView
              ref={listRef}
              data={filteredRows}
              estimatedItemSize={PROTOCOL_ROW_HEIGHT}
              flex={1}
              initialNumToRender={12}
              initialScrollIndex={
                !sourceFilter.length &&
                !statusFilter.length &&
                !Object.keys(e2eFilter).length &&
                !deferredSearchValue &&
                initialScrollIndex >= 0
                  ? initialScrollIndex
                  : undefined
              }
              keyExtractor={(item) => item.protocol.key}
              ListEmptyComponent={
                <Empty
                  flex={1}
                  icon="ListSearchOutline"
                  title="No matching protocols"
                  description="Try another search or filter combination."
                  buttonProps={{
                    children: 'Clear filters',
                    testID: 'custom-injected-clear-filters',
                    onPress: clearFilters,
                  }}
                />
              }
              maxToRenderPerBatch={12}
              renderItem={renderItem}
              testID="custom-injected-protocol-virtual-list"
              windowSize={7}
              onScrollToIndexFailed={({ index }) => {
                listRef.current?.scrollToOffset({
                  animated: false,
                  offset: index * PROTOCOL_ROW_HEIGHT,
                });
              }}
            />
          </YStack>
        ) : null}
      </Page.Body>
      <Page.Footer>
        <XStack
          alignItems="center"
          borderTopColor="$borderSubdued"
          borderTopWidth={1}
          gap="$2"
          px="$4"
          py="$2.5"
          testID="custom-injected-protocol-list-footer"
        >
          <IconButton
            aria-label={validatePendingE2ELabel}
            disabled={refreshing || Boolean(e2eBatchProgress) || !pendingE2EProtocols.length}
            icon="PlayCircleOutline"
            loading={Boolean(e2eBatchProgress)}
            size="small"
            testID="custom-injected-validate-pending-e2e"
            title={validatePendingE2ELabel}
            variant="secondary"
            onPress={() => {
              void validatePendingE2Es();
            }}
          />
          <IconButton
            aria-label="Scroll to top"
            disabled={!filteredRows.length}
            icon="AlignTopOutline"
            size="small"
            testID="custom-injected-scroll-top"
            title="Scroll to top"
            variant="tertiary"
            onPress={scrollToTop}
          />
          <IconButton
            aria-label="Scroll to bottom"
            disabled={!filteredRows.length}
            icon="AlignBottomOutline"
            size="small"
            testID="custom-injected-scroll-bottom"
            title="Scroll to bottom"
            variant="tertiary"
            onPress={scrollToBottom}
          />
          <XStack flex={1} />
          <IconButton
            aria-label="Locate current protocol"
            icon="TargetCircleOutline"
            size="small"
            testID="custom-injected-locate-current"
            title="Locate current protocol"
            variant="tertiary"
            onPress={locateCurrent}
          />
          <IconButton
            aria-label="Previous protocol"
            disabled={Boolean(e2eBatchProgress) || !filteredRows.length || currentIndex === 0}
            icon="ChevronLeftSmallOutline"
            size="small"
            testID="custom-injected-filtered-previous"
            title="Previous protocol"
            variant="secondary"
            onPress={() => {
              selectFilteredRow(currentIndex < 0 ? filteredRows.length - 1 : currentIndex - 1);
            }}
          />
          <SizableText
            color="$textSubdued"
            minWidth={96}
            size="$bodySmMedium"
            textAlign="center"
            testID="custom-injected-filtered-position"
          >
            {`${currentIndex >= 0 ? integer.format(currentIndex + 1) : '–'} / ${integer.format(
              filteredRows.length,
            )}`}
          </SizableText>
          <IconButton
            aria-label="Next protocol"
            disabled={
              Boolean(e2eBatchProgress) ||
              !filteredRows.length ||
              currentIndex === filteredRows.length - 1
            }
            icon="ChevronRightSmallOutline"
            size="small"
            testID="custom-injected-filtered-next"
            title="Next protocol"
            variant="secondary"
            onPress={() => {
              selectFilteredRow(currentIndex < 0 ? 0 : currentIndex + 1);
            }}
          />
        </XStack>
      </Page.Footer>
    </Page>
  );
}
