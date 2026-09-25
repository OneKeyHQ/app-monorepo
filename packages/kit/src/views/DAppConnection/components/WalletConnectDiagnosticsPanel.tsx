import { useState } from 'react';

import {
  Button,
  Divider,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

function formatTime(value?: number) {
  return value
    ? formatDate(new Date(value), { formatTemplate: 'HH:mm:ss.SSS' })
    : '—';
}

function status(value?: boolean, unavailableStatus = 'Unknown') {
  if (value === undefined) {
    return unavailableStatus;
  }
  return value ? 'Yes' : 'No';
}

export function WalletConnectDiagnosticsPanel() {
  const { copyText } = useClipboard();
  const [readFailed, setReadFailed] = useState(false);
  const { result, run } = usePromiseResult(
    async () => {
      try {
        const snapshot =
          await backgroundApiProxy.serviceWalletConnect.getWalletSideDiagnostics();
        setReadFailed(false);
        return snapshot;
      } catch (_error) {
        setReadFailed(true);
        return undefined;
      }
    },
    [],
    { pollingInterval: 2000, revalidateOnFocus: true },
  );
  const socketUnavailableStatus =
    !result || result.snapshotFailed
      ? 'Unavailable (SDK state read failed)'
      : {
          idle: 'Not initialized',
          initializing: 'Initializing',
          failed: 'Initialization failed',
          ready: 'Unavailable',
        }[result.initialization];

  return (
    <YStack
      testID="walletconnect-diagnostics-panel"
      p="$4"
      gap="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
    >
      <SizableText size="$headingMd">
        WalletConnect diagnostics · Wallet
      </SizableText>
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Button
          size="small"
          testID="walletconnect-diagnostics-refresh"
          onPress={() => run()}
        >
          Refresh
        </Button>
        <Button
          size="small"
          testID="walletconnect-diagnostics-copy"
          disabled={!result}
          onPress={() => {
            if (result) {
              copyText(JSON.stringify(result, null, 2));
            }
          }}
        >
          Copy report
        </Button>
        <Button
          size="small"
          testID="walletconnect-diagnostics-clear"
          onPress={async () => {
            await backgroundApiProxy.serviceWalletConnect.clearWalletSideDiagnosticEvents();
            await run();
          }}
        >
          Clear records
        </Button>
      </XStack>
      {readFailed ? (
        <SizableText color="$textCritical">
          Cannot read background diagnostics. Retry with Refresh.
        </SizableText>
      ) : null}
      {!result && !readFailed ? (
        <SizableText>Loading background diagnostics…</SizableText>
      ) : null}
      {result ? (
        <>
          <SizableText size="$bodySm" color="$textSubdued">
            Refreshes every 2s while visible. Records are in memory for this app
            run; only protocol metadata is retained. Counters cover this app run
            and survive Clear records. Reconnect attempts count every socket
            attempt after the first, including retries before the first success.
            Relay fallback alternates .com and .org after a full SDK round (up
            to 5 attempts, 15s per handshake), and waits for old sockets to
            close. Each connection cycle exits after at most 2 SDK rounds / 10
            attempts, including the first pairing round. SDK heartbeat and
            network recovery can start a new cycle; cumulative counters can
            exceed 10.
          </SizableText>
          <SizableText size="$bodySm" selectable>
            {`Updated: ${formatTime(result.capturedAt)}\nInitialization: ${result.initialization}\nSession listeners: ${status(result.listenersRegistered)}\nRelay: ${result.relayUrl} · Switches: ${result.relaySwitches}\nWaiting for old relay to close: ${status(result.relaySwitchPending)}\nSocket connected: ${status(result.connected, socketUnavailableStatus)} · Connecting: ${status(result.connecting, socketUnavailableStatus)}\nConnection attempts: ${result.connectionAttempts} · Reconnect attempts: ${result.reconnectAttempts}\nSuccessful connections: ${result.connectionSuccesses} · Disconnections: ${result.disconnections}\nLast connected: ${formatTime(result.lastConnectedAt)} · Last connection error: ${formatTime(result.lastConnectionErrorAt)}\nTransport registering: ${status(result.providerConnecting, socketUnavailableStatus)} · Has subscription topics: ${status(result.hasSubscriptionTopics, socketUnavailableStatus)}\nTransport explicitly closed: ${status(result.transportExplicitlyClosed, socketUnavailableStatus)}\nSubscriptions: ${result.subscriptions ?? '—'} · Pending: ${result.pendingSubscriptions ?? '—'}\nPairings: ${result.pairings ?? '—'} · Sessions: ${result.sessions ?? '—'} · Pending requests: ${result.pendingRequests ?? '—'}\nLast relay message: ${formatTime(result.lastRelayMessageAt)}\nLast session event: ${formatTime(result.lastSessionEventAt)}\nLast publish acknowledged by relay: ${formatTime(result.lastPublishAt)}`}
          </SizableText>
          {result.snapshotFailed ? (
            <SizableText color="$textCritical" size="$bodySm">
              Some SDK state is unavailable; values may be incomplete.
            </SizableText>
          ) : null}
          <Divider />
          <SizableText size="$bodySm" color="$textSubdued">
            {`Connection: idle is expected before pairing when no sessions are stored.\nCommunication: compare relay messages with session events while sending a DApp request; relay traffic alone does not prove a request was decoded.\nMethods: inspect validation, dispatch, errors and response stages using the request ID. response_submitted means the SDK call completed; publish_acknowledged confirms a relay publish, not DApp receipt.\nLimits: internal SDK decode errors and DApp receipt need SDK or DApp logs. Record details are bounded and do not include signing payloads.`}
          </SizableText>
          {result.sessionDetails.length > 0 ? (
            <YStack gap="$2">
              <SizableText size="$headingSm">
                {`Sessions (${result.sessionDetails.length}/${result.sessions ?? 0})`}
              </SizableText>
              {result.sessionDetails.map((session, index) => (
                <SizableText
                  key={`${session.topic ?? ''}-${index}`}
                  size="$bodySm"
                  selectable
                >
                  {`Topic ${session.topic ?? '—'} · Acknowledged: ${status(session.acknowledged)}\nSubscribed: ${status(session.subscribed)} · Subscription pending: ${status(session.subscriptionPending)}\n${session.expiresAt <= result.capturedAt ? 'Expired' : 'Expires'}: ${formatDate(new Date(session.expiresAt))}\nChains: ${session.chains.join(', ') || '—'}\nMethods: ${session.methods.join(', ') || '—'}`}
                </SizableText>
              ))}
            </YStack>
          ) : null}
          {result.pendingRequestDetails.length > 0 ? (
            <YStack gap="$2">
              <SizableText size="$headingSm">
                {`Pending requests (${result.pendingRequestDetails.length}/${result.pendingRequests ?? 0})`}
              </SizableText>
              {result.pendingRequestDetails.map((request, index) => (
                <SizableText
                  key={`${request.requestId ?? ''}-${index}`}
                  size="$bodySm"
                  selectable
                >
                  {`ID ${request.requestId ?? '—'} · ${request.method ?? '—'} · ${request.chainId ?? '—'}\nTopic ${request.topic ?? '—'} · Received: ${formatTime(request.receivedAt)}\nWaiting: ${request.receivedAt === undefined ? 'Unknown (received before retained history)' : `${Math.max(0, Math.floor((result.capturedAt - request.receivedAt) / 1000))}s`} · Expires: ${formatTime(request.expiresAt)}`}
                </SizableText>
              ))}
            </YStack>
          ) : null}
          <SizableText size="$headingSm">
            {`Recent messages & events (${result.events.length}/${result.eventLimit})`}
          </SizableText>
          {result.events.length === 0 ? (
            <SizableText size="$bodySm" color="$textSubdued">
              No records yet. Send a request from the DApp to observe it here.
            </SizableText>
          ) : null}
          {result.events.map((event) => (
            <YStack key={event.sequence} gap="$1">
              <SizableText
                size="$bodySmMedium"
                color={event.level === 'error' ? '$textCritical' : '$text'}
                selectable
              >
                {`${formatTime(event.timestamp)} · ${event.stage} · ${event.event}`}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                {[
                  event.requestId === undefined
                    ? undefined
                    : `ID ${event.requestId}`,
                  event.method,
                  event.chainId,
                  event.topic ? `Topic ${event.topic}` : undefined,
                  event.errorCode === undefined
                    ? undefined
                    : `Code ${event.errorCode}`,
                  event.errorCategory,
                  event.previousRelayUrl && event.relayUrl
                    ? `${event.previousRelayUrl} → ${event.relayUrl}`
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </SizableText>
            </YStack>
          ))}
        </>
      ) : null}
    </YStack>
  );
}
