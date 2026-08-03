import {
  Badge,
  Button,
  Checkbox,
  Input,
  ScrollView,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { sniRequestQaAdapter } from '@onekeyhq/shared/src/request/helpers/sniRequestQa';

import { QA_CASES, QA_CASE_IDS, useSniRequestQa } from './useSniRequestQa';

import type { IQaCaseStatus, IQueueRequestStatus } from './useSniRequestQa';

function getCaseBadgeType(
  status: IQaCaseStatus,
): 'critical' | 'default' | 'info' | 'success' | 'warning' {
  if (status === 'passed') return 'success';
  if (status === 'failed') return 'critical';
  if (status === 'running') return 'info';
  if (status === 'pending') return 'warning';
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
    selectedCaseIds,
    setCaseSelected,
    setExpandedEvidenceCaseIds,
    setRunCompleted,
    setSelectedCaseIds,
    setTarget,
    snapshot,
    snapshotError,
    summary,
    target,
  } = useSniRequestQa();

  return (
    <Stack gap="$5" testID="desktop-sni-queue-panel">
      <Stack gap="$1">
        <SizableText size="$headingMd">SNI request QA</SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Evidence comes from real renderer outcomes, transport cancellation
          acknowledgements, and {sniRequestQaAdapter.transportLabel} limiter
          snapshots. A missing observation is reported as FAIL.
        </SizableText>
      </Stack>

      <XStack gap="$3" flexWrap="wrap">
        <Stack gap="$1" flex={1} minWidth={160}>
          <SizableText size="$bodySm" color="$textSubdued">
            IP
          </SizableText>
          <Input
            value={target.ip}
            onChangeText={(ip) => setTarget((current) => ({ ...current, ip }))}
            disabled={isRunning}
            autoCapitalize="none"
          />
        </Stack>
        <Stack gap="$1" flex={1} minWidth={200}>
          <SizableText size="$bodySm" color="$textSubdued">
            SNI hostname
          </SizableText>
          <Input
            value={target.hostname}
            onChangeText={(hostname) =>
              setTarget((current) => ({ ...current, hostname }))
            }
            disabled={isRunning}
            autoCapitalize="none"
          />
        </Stack>
        <Stack gap="$1" flex={1} minWidth={220}>
          <SizableText size="$bodySm" color="$textSubdued">
            Path
          </SizableText>
          <Input
            value={target.path}
            onChangeText={(path) =>
              setTarget((current) => ({ ...current, path }))
            }
            disabled={isRunning}
            autoCapitalize="none"
          />
        </Stack>
      </XStack>

      <Stack gap="$2">
        <XStack justifyContent="space-between" alignItems="center" gap="$3">
          <SizableText size="$headingSm">Select cases</SizableText>
          <XStack gap="$2">
            <Button
              size="small"
              variant="tertiary"
              disabled={isRunning}
              testID="desktop-sni-cases-select-all"
              onPress={() => {
                setSelectedCaseIds([...QA_CASE_IDS]);
                setRunCompleted(false);
              }}
            >
              Select all
            </Button>
            <Button
              size="small"
              variant="tertiary"
              disabled={isRunning}
              testID="desktop-sni-cases-clear"
              onPress={() => {
                setSelectedCaseIds([]);
                setRunCompleted(false);
              }}
            >
              Clear
            </Button>
          </XStack>
        </XStack>

        <XStack gap="$3" flexWrap="wrap" alignItems="center">
          <Button
            variant="primary"
            onPress={() => void handleRun()}
            disabled={isRunning || selectedCaseIds.length === 0}
            testID="desktop-sni-queue-run"
          >
            Run selected ({selectedCaseIds.length})
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
          <SizableText size="$bodySm" color="$textSubdued">
            Passed {summary.passed} / Failed {summary.failed} / Stopped{' '}
            {summary.stopped}
          </SizableText>
        </XStack>

        <Stack borderTopWidth={1} borderColor="$borderSubdued">
          {QA_CASES.map((qaCase) => {
            const result = caseResults[qaCase.id];
            const isSelected = selectedCaseIds.includes(qaCase.id);
            const isEvidenceExpanded = expandedEvidenceCaseIds.includes(
              qaCase.id,
            );
            return (
              <Stack
                key={qaCase.id}
                py="$3"
                gap="$2"
                borderBottomWidth={1}
                borderColor="$borderSubdued"
              >
                <XStack gap="$3" alignItems="center">
                  <Checkbox
                    value={isSelected}
                    disabled={isRunning}
                    onChange={(value) =>
                      setCaseSelected(qaCase.id, Boolean(value))
                    }
                    testID={`desktop-sni-case-${qaCase.id}`}
                  />
                  <Stack flex={1} minWidth={0}>
                    <SizableText size="$bodyMdMedium">
                      {qaCase.title}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {qaCase.description}
                    </SizableText>
                  </Stack>
                  {result.durationMs === undefined ? null : (
                    <SizableText size="$bodyXs" color="$textSubdued">
                      {result.durationMs} ms
                    </SizableText>
                  )}
                  <Badge
                    badgeType={getCaseBadgeType(result.status)}
                    badgeSize="sm"
                    testID={`desktop-sni-case-${qaCase.id}-result`}
                  >
                    <Badge.Text>{result.status.toUpperCase()}</Badge.Text>
                  </Badge>
                </XStack>

                {result.evidence.length > 0 ? (
                  <Stack pl="$8" gap="$2" alignItems="flex-start">
                    <Button
                      size="small"
                      variant="tertiary"
                      testID={`desktop-sni-case-${qaCase.id}-evidence-toggle`}
                      onPress={() =>
                        setExpandedEvidenceCaseIds((current) =>
                          current.includes(qaCase.id)
                            ? current.filter((caseId) => caseId !== qaCase.id)
                            : [...current, qaCase.id],
                        )
                      }
                    >
                      {isEvidenceExpanded
                        ? 'Hide evidence'
                        : `View evidence (${result.evidence.length})`}
                    </Button>
                    {isEvidenceExpanded ? (
                      <ScrollView maxHeight={320} width="100%">
                        <Stack gap="$1" pr="$2">
                          {result.evidence.map((evidence) => (
                            <Stack key={evidence.id} gap="$1" py="$1">
                              <XStack gap="$2" alignItems="center">
                                <SizableText
                                  minWidth={64}
                                  size="$bodyXs"
                                  color="$textSubdued"
                                >
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
                      </ScrollView>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      </Stack>

      <XStack gap="$5" flexWrap="wrap">
        <Stack minWidth={120}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Pair active
          </SizableText>
          <SizableText size="$headingLg" testID="desktop-sni-main-active">
            {snapshot?.activeRequestsForPair ?? '-'}
          </SizableText>
        </Stack>
        <Stack minWidth={120}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Pair pending
          </SizableText>
          <SizableText size="$headingLg" testID="desktop-sni-main-pending">
            {snapshot?.pendingRequestsForPair ?? '-'}
          </SizableText>
        </Stack>
        <Stack minWidth={120}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Global active
          </SizableText>
          <SizableText size="$headingLg">
            {snapshot?.activeRequests ?? '-'}
          </SizableText>
        </Stack>
        <Stack minWidth={120}>
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

      {items.length > 0 ? (
        <Stack gap="$2">
          <SizableText size="$headingSm">Latest 20-request batch</SizableText>
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
                  minHeight={40}
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
        </Stack>
      ) : null}
    </Stack>
  );
}
