import { useState } from 'react';

import {
  Badge,
  Button,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { sniRequestQaAdapter } from '@onekeyhq/shared/src/request/helpers/sniRequestQa';

import {
  QA_CASES,
  QA_CASE_IDS,
  SNI_QA_FIXED_TARGET,
  useSniRequestQa,
} from './useSniRequestQa';

import type { IQaCaseStatus, IQueueRequestStatus } from './useSniRequestQa';

function getCaseBadgeType(
  status: IQaCaseStatus,
): 'critical' | 'default' | 'info' | 'success' | 'warning' {
  if (status === 'passed') return 'success';
  if (status === 'failed') return 'critical';
  if (status === 'running') return 'info';
  if (status === 'pending' || status === 'not-observed') return 'warning';
  return 'default';
}

function getRequestBadgeType(
  status: IQueueRequestStatus,
): 'critical' | 'default' | 'info' | 'success' | 'warning' {
  if (status === 'active') return 'info';
  if (status === 'queued') return 'warning';
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'critical';
  return 'default';
}

export function SniRequestQaTest() {
  const {
    cancelOwnedRequest,
    caseResults,
    expandedEvidenceCaseIds,
    handleReset,
    handleRun,
    handleStop,
    isRunning,
    items,
    overallBadgeType,
    overallLabel,
    setExpandedEvidenceCaseIds,
    snapshot,
    snapshotError,
    summary,
  } = useSniRequestQa();
  const [requestDetailsExpanded, setRequestDetailsExpanded] = useState(false);

  return (
    <Page scrollEnabled testID="desktop-sni-queue-panel">
      <Page.Header title="SNI Request QA" />
      <Page.Body>
        <Page.Container gap="$6" pb="$10">
          <Stack gap="$2">
            <SizableText size="$headingSm">
              Fixed first-party target
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {SNI_QA_FIXED_TARGET.hostname} ({SNI_QA_FIXED_TARGET.ip})
              {SNI_QA_FIXED_TARGET.path}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              Results come from real HTTP outcomes, AbortController signals,
              {` ${sniRequestQaAdapter.transportLabel}`} acknowledgements, and
              limiter snapshots. A fast request that prevents cancellation
              observation is reported as NOT OBSERVED.
            </SizableText>
          </Stack>

          <Stack
            gap="$3"
            py="$4"
            borderTopWidth={1}
            borderBottomWidth={1}
            borderColor="$borderSubdued"
          >
            <XStack gap="$3" flexWrap="wrap" alignItems="center">
              <Button
                variant="primary"
                onPress={() => void handleRun(QA_CASE_IDS)}
                disabled={isRunning}
                testID="desktop-sni-queue-run"
              >
                Run all cases
              </Button>
              <Button
                variant="destructive"
                onPress={handleStop}
                disabled={!isRunning}
                testID="desktop-sni-queue-cancel-all"
              >
                Stop run
              </Button>
              <Button
                variant="secondary"
                onPress={handleReset}
                disabled={isRunning}
              >
                Reset results
              </Button>
              <Badge
                testID="desktop-sni-queue-result"
                badgeType={overallBadgeType}
                badgeSize="lg"
              >
                <Badge.Text>{overallLabel}</Badge.Text>
              </Badge>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              Passed {summary.passed} / Failed {summary.failed} / Not observed{' '}
              {summary.notObserved} / Stopped {summary.stopped}
            </SizableText>
          </Stack>

          <Stack gap="$3">
            <SizableText size="$headingMd">Test cases</SizableText>
            <Stack borderTopWidth={1} borderColor="$borderSubdued">
              {QA_CASES.map((qaCase) => {
                const result = caseResults[qaCase.id];
                const isEvidenceExpanded = expandedEvidenceCaseIds.includes(
                  qaCase.id,
                );
                return (
                  <Stack
                    key={qaCase.id}
                    py="$4"
                    gap="$3"
                    borderBottomWidth={1}
                    borderColor="$borderSubdued"
                  >
                    <XStack gap="$3" alignItems="flex-start">
                      <Stack flex={1} minWidth={0} gap="$1">
                        <SizableText size="$bodyLgMedium">
                          {qaCase.title}
                        </SizableText>
                        <SizableText size="$bodySm" color="$textSubdued">
                          {qaCase.description}
                        </SizableText>
                      </Stack>
                      <Badge
                        badgeType={getCaseBadgeType(result.status)}
                        badgeSize="sm"
                        testID={`desktop-sni-case-${qaCase.id}-result`}
                      >
                        <Badge.Text>
                          {result.status.toUpperCase().replace('-', ' ')}
                        </Badge.Text>
                      </Badge>
                    </XStack>

                    <XStack gap="$3" alignItems="center" flexWrap="wrap">
                      <Button
                        size="small"
                        variant="primary"
                        disabled={isRunning}
                        testID={`desktop-sni-case-${qaCase.id}-run`}
                        onPress={() => void handleRun([qaCase.id])}
                      >
                        Run case
                      </Button>
                      {result.durationMs === undefined ? null : (
                        <SizableText size="$bodyXs" color="$textSubdued">
                          {result.durationMs} ms
                        </SizableText>
                      )}
                      {result.evidence.length > 0 ? (
                        <Button
                          size="small"
                          variant="tertiary"
                          testID={`desktop-sni-case-${qaCase.id}-evidence-toggle`}
                          onPress={() =>
                            setExpandedEvidenceCaseIds((current) =>
                              current.includes(qaCase.id)
                                ? current.filter(
                                    (caseId) => caseId !== qaCase.id,
                                  )
                                : [...current, qaCase.id],
                            )
                          }
                        >
                          {isEvidenceExpanded
                            ? 'Hide evidence'
                            : `View evidence (${result.evidence.length})`}
                        </Button>
                      ) : null}
                    </XStack>

                    {isEvidenceExpanded ? (
                      <Stack gap="$2" pl="$2">
                        {result.evidence.map((evidence) => (
                          <Stack key={evidence.id} gap="$1" py="$1">
                            <XStack
                              gap="$2"
                              alignItems="center"
                              flexWrap="wrap"
                            >
                              <SizableText size="$bodyXs" color="$textSubdued">
                                +{evidence.elapsedMs} ms
                              </SizableText>
                              <Badge badgeType={evidence.tone} badgeSize="sm">
                                <Badge.Text>{evidence.label}</Badge.Text>
                              </Badge>
                            </XStack>
                            <SizableText
                              size="$bodyXs"
                              color={
                                evidence.tone === 'critical'
                                  ? '$textCritical'
                                  : '$textSubdued'
                              }
                            >
                              {evidence.value}
                            </SizableText>
                          </Stack>
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                );
              })}
            </Stack>
          </Stack>

          <Stack gap="$3">
            <SizableText size="$headingMd">Live limiter</SizableText>
            <XStack gap="$5" flexWrap="wrap">
              <Stack minWidth={100}>
                <SizableText size="$bodyXs" color="$textSubdued">
                  Pair active
                </SizableText>
                <SizableText size="$headingLg" testID="desktop-sni-main-active">
                  {snapshot?.activeRequestsForPair ?? '-'}
                </SizableText>
              </Stack>
              <Stack minWidth={100}>
                <SizableText size="$bodyXs" color="$textSubdued">
                  Pair pending
                </SizableText>
                <SizableText
                  size="$headingLg"
                  testID="desktop-sni-main-pending"
                >
                  {snapshot?.pendingRequestsForPair ?? '-'}
                </SizableText>
              </Stack>
              <Stack minWidth={100}>
                <SizableText size="$bodyXs" color="$textSubdued">
                  Global active
                </SizableText>
                <SizableText size="$headingLg">
                  {snapshot?.activeRequests ?? '-'}
                </SizableText>
              </Stack>
              <Stack minWidth={100}>
                <SizableText size="$bodyXs" color="$textSubdued">
                  Global pending
                </SizableText>
                <SizableText size="$headingLg">
                  {snapshot?.pendingRequests ?? '-'}
                </SizableText>
              </Stack>
            </XStack>
            {snapshotError ? (
              <SizableText color="$textCritical" size="$bodySm">
                Snapshot error: {snapshotError}
              </SizableText>
            ) : null}
          </Stack>

          {items.length > 0 ? (
            <Stack gap="$3">
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
              >
                <SizableText size="$headingMd">
                  Latest request batch ({items.length})
                </SizableText>
                <Button
                  size="small"
                  variant="tertiary"
                  onPress={() =>
                    setRequestDetailsExpanded((current) => !current)
                  }
                >
                  {requestDetailsExpanded ? 'Hide details' : 'View details'}
                </Button>
              </XStack>
              {requestDetailsExpanded ? (
                <Stack borderTopWidth={1} borderColor="$borderSubdued">
                  {items.map((item) => {
                    const canCancel =
                      isRunning &&
                      (item.status === 'starting' ||
                        item.status === 'active' ||
                        item.status === 'queued');
                    return (
                      <XStack
                        key={item.requestId}
                        minHeight={44}
                        py="$2"
                        gap="$3"
                        alignItems="center"
                        borderBottomWidth={1}
                        borderColor="$borderSubdued"
                      >
                        <SizableText width={32} size="$bodySmMedium">
                          {item.index + 1}
                        </SizableText>
                        <Badge
                          badgeType={getRequestBadgeType(item.status)}
                          badgeSize="sm"
                        >
                          <Badge.Text>{item.status}</Badge.Text>
                        </Badge>
                        <SizableText
                          flex={1}
                          minWidth={0}
                          size="$bodySm"
                          color="$textSubdued"
                        >
                          {item.detail}
                        </SizableText>
                        <Button
                          size="small"
                          variant="tertiary"
                          disabled={!canCancel}
                          onPress={() => cancelOwnedRequest(item.requestId)}
                        >
                          Cancel
                        </Button>
                      </XStack>
                    );
                  })}
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Page.Container>
      </Page.Body>
    </Page>
  );
}

export default SniRequestQaTest;
