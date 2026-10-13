// cspell:ignore presign
import {
  Alert,
  Badge,
  Button,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  maskBinanceDepositSessionId,
  maskBinanceDepositTxHash,
} from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import type {
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositDebugEvent,
  IBinanceDepositLocalReport,
  IBinanceDepositSessionSnapshot,
} from '@onekeyhq/shared/types/exchange';

import { BinanceDepositTestIDs } from '../testIDs';
import {
  formatBinanceDepositClockTime,
  formatBinanceDepositCode,
  formatBinanceDepositCountdown,
  formatBinanceDepositDateTime,
  formatBinanceDepositEventDetail,
  getBinanceDepositNextStepHint,
  getBinanceDepositReportBadgeType,
  getBinanceDepositStatusBadgeType,
  getBinanceDepositStatusLabel,
} from '../utils';

import {
  DepositField,
  DepositHint,
  DepositSection,
} from './BinanceDepositLayout';

function describeBindState(session: IBinanceDepositSessionSnapshot): string {
  if (!session.hasPendingNonce) {
    return 'idle';
  }
  return session.bindInFlight
    ? 'running (request in flight)'
    : 'running (waiting to retry)';
}

function describeDeadline(target: number | undefined, now: number): string {
  if (typeof target !== 'number') {
    return '-';
  }
  return `${formatBinanceDepositCountdown(
    target,
    now,
  )} (at ${formatBinanceDepositClockTime(target)})`;
}

// What becomes of a return that arrives while the app points at another
// environment. Switching the environment restarts the app: iOS keeps the
// process, and with it the link the system handed over, Android does not.
function describeReturnOnOtherEndpoint(): string {
  return platformEnv.isNativeAndroid
    ? 'On Android, switching the environment restarts the app process, so a return that arrived in the meantime cannot be recovered. If one did arrive, abandon this session and create a new one.'
    : 'On iOS it is handled again when this page is opened after the app is back on that environment. If it is not, abandon this session and create a new one.';
}

export function SessionSection({
  session,
  networkName,
  now,
}: {
  session?: IBinanceDepositSessionSnapshot;
  networkName?: string;
  now: number;
}) {
  return (
    <DepositSection
      title="Session"
      headerRight={
        <Badge
          badgeType={getBinanceDepositStatusBadgeType(session)}
          badgeSize="lg"
          testID={BinanceDepositTestIDs.statusBadge}
        >
          <Badge.Text>{getBinanceDepositStatusLabel(session)}</Badge.Text>
        </Badge>
      }
    >
      <DepositHint>{getBinanceDepositNextStepHint(session)}</DepositHint>
      {session?.endpointMismatch ? (
        <Alert
          type="critical"
          title="Created on another server environment"
          description={`This session exists on ${
            session.walletEndpoint ?? 'another environment'
          } only, and the app now points somewhere else. Nothing is sent for it until the app is switched back (Developer settings > Basic Info); it can still be abandoned. A return from Binance that arrives in the meantime is not taken in here. ${describeReturnOnOtherEndpoint()}`}
          testID={BinanceDepositTestIDs.endpointMismatchAlert}
        />
      ) : null}
      {session ? (
        <Stack gap="$2">
          <DepositField
            label="Session ID"
            value={session.sessionIdMasked || '-'}
            testID={BinanceDepositTestIDs.sessionId}
          />
          <DepositField
            label="Local ID"
            value={maskBinanceDepositSessionId(session.localId)}
          />
          <DepositField
            label="Asset"
            value={`${session.cryptoCurrency} on ${
              networkName ?? session.networkId
            } (${session.contractAddress ?? 'native'})`}
          />
          <DepositField label="Sender" value={session.senderAddress} />
          <DepositField
            label="Link expires in"
            value={describeDeadline(session.linkExpireTime, now)}
            testID={BinanceDepositTestIDs.linkCountdown}
          />
          <DepositField
            label="Bind deadline in"
            value={describeDeadline(session.bindDeadline, now)}
            testID={BinanceDepositTestIDs.bindCountdown}
          />
          <DepositField
            label="Link opened at"
            value={formatBinanceDepositClockTime(session.linkOpenedAt)}
          />
          <DepositField
            label="Awaiting return"
            value={session.awaitingReturn ? 'yes' : 'no'}
            testID={BinanceDepositTestIDs.awaitingReturn}
          />
          <DepositField
            label="Return received"
            value={formatBinanceDepositClockTime(session.returnReceivedAt)}
          />
          <DepositField label="Bind loop" value={describeBindState(session)} />
          <DepositField
            label="Bind attempts"
            value={`${session.bindAttempts ?? 0}, last code ${formatBinanceDepositCode(
              session.lastBindCode,
            )}`}
            testID={BinanceDepositTestIDs.bindAttempts}
          />
          <DepositField
            label="Last error code"
            value={formatBinanceDepositCode(session.lastErrorCode)}
            tone={session.lastErrorCode ? 'critical' : 'default'}
          />
          <DepositField
            label="Pre-sign check"
            value={formatBinanceDepositClockTime(session.presignCheckedAt)}
          />
          <DepositField
            label="Created"
            value={formatBinanceDepositDateTime(session.createdAt)}
          />
          <DepositField
            label="Updated"
            value={formatBinanceDepositDateTime(session.updatedAt)}
          />
          <DepositHint>
            Deadlines are server timestamps compared with this device clock.
          </DepositHint>
        </Stack>
      ) : null}
    </DepositSection>
  );
}

export function DestinationSection({
  destination,
  onCopy,
}: {
  destination: IBinanceDepositAuthorizedDestination;
  onCopy: (text: string) => void;
}) {
  const { address, addressTag } = destination;
  return (
    <DepositSection title="Destination">
      <Stack gap="$2">
        <DepositField
          label="Address"
          value={address}
          testID={BinanceDepositTestIDs.destinationAddress}
          onCopy={() => onCopy(address)}
          copyTestID={BinanceDepositTestIDs.copyAddressBtn}
        />
        <DepositField
          label="Tag"
          value={addressTag || 'none'}
          testID={BinanceDepositTestIDs.destinationTag}
          onCopy={addressTag ? () => onCopy(addressTag) : undefined}
          copyTestID={BinanceDepositTestIDs.copyTagBtn}
        />
        <DepositField
          label="Min amount"
          value={destination.minAmount || 'none'}
          testID={BinanceDepositTestIDs.destinationMinAmount}
        />
        <DepositField
          label="Asset"
          value={`${destination.cryptoCurrency} on ${destination.networkId} / ${
            destination.binanceNetwork
          } (${destination.contractAddress ?? 'native'})`}
        />
        <DepositField
          label="Authorized at"
          value={formatBinanceDepositDateTime(destination.authorizedAt)}
        />
      </Stack>
    </DepositSection>
  );
}

export function ReportSection({
  report,
  canRetry,
  isRetrying,
  isBusy,
  onRetry,
  onCopy,
}: {
  report?: IBinanceDepositLocalReport;
  canRetry: boolean;
  isRetrying: boolean;
  isBusy: boolean;
  onRetry: () => void;
  onCopy: (text: string) => void;
}) {
  return (
    <DepositSection
      title="Report"
      headerRight={
        <Badge
          badgeType={getBinanceDepositReportBadgeType(report?.status)}
          badgeSize="lg"
          testID={BinanceDepositTestIDs.reportStatusBadge}
        >
          <Badge.Text>{report?.status ?? 'NONE'}</Badge.Text>
        </Badge>
      }
    >
      {report ? (
        <Stack gap="$2">
          <DepositField
            label="Tx hash"
            value={maskBinanceDepositTxHash(report.txHash)}
            testID={BinanceDepositTestIDs.reportTxHash}
            onCopy={() => onCopy(report.txHash)}
            copyTestID={BinanceDepositTestIDs.copyTxHashBtn}
          />
          <DepositField label="Sender" value={report.senderAddress} />
          <DepositField label="Attempts" value={String(report.attempts)} />
          <DepositField
            label="Last error code"
            value={formatBinanceDepositCode(report.lastErrorCode)}
            tone={report.lastErrorCode ? 'critical' : 'default'}
          />
          <DepositField
            label="Updated"
            value={formatBinanceDepositDateTime(report.updatedAt)}
          />
          <XStack>
            <Button
              size="small"
              variant="secondary"
              disabled={!canRetry || isBusy}
              loading={isRetrying}
              onPress={onRetry}
              testID={BinanceDepositTestIDs.retryReportBtn}
            >
              Retry report
            </Button>
          </XStack>
        </Stack>
      ) : (
        <DepositHint>No transaction was reported for this session.</DepositHint>
      )}
    </DepositSection>
  );
}

export function RecentSessionsSection({
  sessions,
  isExpanded,
  onToggle,
}: {
  sessions: IBinanceDepositSessionSnapshot[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (sessions.length === 0) {
    return null;
  }
  return (
    <DepositSection
      title={`Earlier sessions (${sessions.length})`}
      headerRight={
        <Button
          size="small"
          variant="tertiary"
          onPress={onToggle}
          testID={BinanceDepositTestIDs.toggleRecentBtn}
        >
          {isExpanded ? 'Hide' : 'Show'}
        </Button>
      }
    >
      {isExpanded ? (
        <Stack gap="$2">
          {sessions.map((session) => (
            <XStack
              key={session.localId}
              gap="$2"
              alignItems="center"
              flexWrap="wrap"
            >
              <Badge
                badgeType={getBinanceDepositStatusBadgeType(session)}
                badgeSize="sm"
              >
                <Badge.Text>{getBinanceDepositStatusLabel(session)}</Badge.Text>
              </Badge>
              <SizableText size="$bodySm" color="$textSubdued">
                {session.sessionIdMasked ||
                  maskBinanceDepositSessionId(session.localId)}{' '}
                {session.cryptoCurrency} on {session.networkId}, report{' '}
                {session.report?.status ?? 'none'},{' '}
                {formatBinanceDepositDateTime(session.createdAt)}
              </SizableText>
            </XStack>
          ))}
        </Stack>
      ) : null}
    </DepositSection>
  );
}

export function EventsSection({
  events,
}: {
  events: IBinanceDepositDebugEvent[];
}) {
  return (
    <DepositSection title={`Events (${events.length})`}>
      <DepositHint>
        Newest first. Same content as the local log; kept in memory only and
        cleared when the app restarts.
      </DepositHint>
      <Stack testID={BinanceDepositTestIDs.eventList}>
        {events.map((event, index) => (
          <Stack
            key={`${event.ts}-${event.step}-${index}`}
            py="$1.5"
            borderBottomWidth={1}
            borderColor="$borderSubdued"
          >
            <XStack gap="$2" alignItems="center">
              <SizableText size="$bodyXs" color="$textSubdued">
                {formatBinanceDepositClockTime(event.ts)}
              </SizableText>
              <SizableText size="$bodySmMedium">{event.step}</SizableText>
            </XStack>
            <SizableText size="$bodyXs" color="$textSubdued">
              {formatBinanceDepositEventDetail(event.detail)}
            </SizableText>
          </Stack>
        ))}
      </Stack>
    </DepositSection>
  );
}
