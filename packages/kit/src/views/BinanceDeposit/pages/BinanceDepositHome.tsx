import { memo, useCallback, useMemo, useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Input,
  Page,
  Select,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/exchange';
import type { IBinanceDepositDebugEvent } from '@onekeyhq/shared/types/exchange';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  DepositField,
  DepositHint,
  DepositSection,
} from '../components/BinanceDepositLayout';
import {
  DestinationSection,
  EventsSection,
  RecentSessionsSection,
  ReportSection,
  SessionSection,
} from '../components/BinanceDepositSessionSections';
import { useBinanceDepositActions } from '../hooks/useBinanceDepositActions';
import { useBinanceDepositAssets } from '../hooks/useBinanceDepositAssets';
import { useBinanceDepositPageLog } from '../hooks/useBinanceDepositPageLog';
import { useBinanceDepositSend } from '../hooks/useBinanceDepositSend';
import { useBinanceDepositSender } from '../hooks/useBinanceDepositSender';
import { useBinanceDepositState } from '../hooks/useBinanceDepositState';
import { BINANCE_DEPOSIT_SIGN_ONLY_TEXT } from '../sendFlow';
import { BinanceDepositTestIDs } from '../testIDs';
import {
  describeBinanceDepositAmountFloor,
  formatBinanceDepositDateTime,
  getBinanceDepositAmountFloor,
  getBinanceDepositSendAttemptAckWaitSeconds,
  getBinanceDepositSessionFlags,
  mergeBinanceDepositEvents,
} from '../utils';

const PAGE_TITLE = 'Binance Deposit (self-test)';
// The amount must be typed with a dot. The iOS decimal pad only offers the
// decimal separator of the device locale, which is a comma in many regions.
const AMOUNT_KEYBOARD_TYPE = platformEnv.isNativeIOS
  ? 'numbers-and-punctuation'
  : 'decimal-pad';
const NO_EVENTS: IBinanceDepositDebugEvent[] = [];

const MemoEventsSection = memo(EventsSection);

function BinanceDepositHomeContent() {
  const { copyText } = useClipboard();
  const [devSettings] = useDevSettingsPersistAtom();
  const isTestEndpoint = Boolean(
    devSettings.enabled && devSettings.settings?.enableTestEndpoint,
  );
  const isSignOnlyEnabled = Boolean(
    devSettings.enabled && devSettings.settings?.alwaysSignOnlySendTx,
  );
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { state, isStateUnavailable, now, refresh } = useBinanceDepositState();
  const active = state?.active;
  const flags = useMemo(() => getBinanceDepositSessionFlags(active), [active]);

  const assets = useBinanceDepositAssets({
    preferredNetworkId: activeAccount.network?.id,
  });
  const selectedNetworkId = assets.network?.networkId;
  const {
    sender,
    isLoading: isSenderLoading,
    isWatchingAccount,
    accountName,
    createSenderAddress,
  } = useBinanceDepositSender({ networkId: selectedNetworkId });

  const { pageEvents, logLinkOpen, logSendResult } = useBinanceDepositPageLog();
  const actions = useBinanceDepositActions({
    active,
    network: assets.network,
    symbol: assets.symbol,
    sender,
    createSenderAddress,
    refreshState: refresh,
    reloadAssets: assets.reloadAssets,
    logLinkOpen,
  });
  const { busyAction } = actions;
  const isBusy = busyAction !== undefined;

  // The asset of the active session as the asset list has it now; undefined
  // while the list is loading or once it no longer carries the asset.
  const activeSymbol = active
    ? assets.findSymbol({
        networkId: active.networkId,
        symbol: active.cryptoCurrency,
      })
    : undefined;
  // The list is loaded and still carries the asset of the session. Only then
  // does a missing deposit dust mean that the asset has none.
  const isAssetListReady =
    !assets.isLoading && !assets.loadFailed && activeSymbol !== undefined;
  const send = useBinanceDepositSend({
    session: active,
    requiresAddressTag: activeSymbol?.requiresAddressTag,
    depositDust: activeSymbol?.depositDust,
    isAssetListReady,
    isSignOnlyEnabled,
    refreshState: refresh,
    logSendResult,
  });
  const { amount, setAmount } = send;

  const [isRecentExpanded, setIsRecentExpanded] = useState(false);

  const backgroundEvents = state?.events ?? NO_EVENTS;
  const events = useMemo(
    () => mergeBinanceDepositEvents(backgroundEvents, pageEvents),
    [backgroundEvents, pageEvents],
  );

  const networkItems = useMemo<ISelectItem[]>(
    () =>
      assets.networks.map((item) => {
        const name = assets.networkNames[item.networkId];
        return {
          label: name ? `${name} (${item.networkId})` : item.networkId,
          value: item.networkId,
        };
      }),
    [assets.networkNames, assets.networks],
  );
  const symbolItems = useMemo<ISelectItem[]>(
    () =>
      (assets.network?.symbols ?? []).map((item) => ({
        label: item.requiresAddressTag
          ? `${item.symbol} (tag required)`
          : item.symbol,
        value: item.symbol,
        description: item.contractAddress ?? 'native',
      })),
    [assets.network],
  );

  const handleCopy = useCallback(
    (text: string) => {
      copyText(text);
    },
    [copyText],
  );
  const handleToggleRecent = useCallback(() => {
    setIsRecentExpanded((current) => !current);
  }, []);
  const { reviewAndSend } = send;
  const handleReviewSend = useCallback(() => {
    void reviewAndSend(amount);
  }, [amount, reviewAndSend]);

  let senderText = 'No address on this network';
  if (sender) {
    senderText = sender.address;
  } else if (isWatchingAccount) {
    senderText = 'Watch-only account';
  } else if (isSenderLoading) {
    senderText = 'Loading...';
  } else if (!selectedNetworkId) {
    senderText = '-';
  }
  const canCreateAddress =
    !!selectedNetworkId && !sender && !isWatchingAccount && !isSenderLoading;

  // A session closed on this device (abandoned, key lost, mismatch) keeps its
  // AUTHORIZED status and record, but its address is not offered any more.
  const destination =
    active?.status === EBinanceDepositSessionStatus.AUTHORIZED &&
    !active.localClosedReason
      ? active.destination
      : undefined;
  // The same floor the transfer is checked against.
  const amountFloor = useMemo(
    () =>
      getBinanceDepositAmountFloor({
        minAmount: destination?.minAmount,
        depositDust: activeSymbol?.depositDust,
        isAssetListReady,
      }),
    [activeSymbol?.depositDust, destination?.minAmount, isAssetListReady],
  );
  // The destination sets no minimum and the asset list could not be asked
  // for one: the transfer stays off until the list is there again.
  const isMinAmountUnknown =
    !amountFloor.ok && amountFloor.reason === 'min_amount_unknown';
  const canReviewSend =
    flags.canSend &&
    !isSignOnlyEnabled &&
    !send.hasSentLocally &&
    !send.isPreparing &&
    !isBusy &&
    !isMinAmountUnknown;
  // For this long after signing was allowed to start, the transfer may still
  // be on its way out and the service refuses to lift the hold.
  const ackWaitSeconds = flags.needsSendAttemptAck
    ? getBinanceDepositSendAttemptAckWaitSeconds(active, now)
    : 0;
  const isAckOnHold = ackWaitSeconds > 0;

  return (
    <Page scrollEnabled testID={BinanceDepositTestIDs.page}>
      <Page.Header title={PAGE_TITLE} />
      <Page.Body>
        <Page.Container gap="$4" pb="$10">
          <DepositSection title="Environment">
            <XStack gap="$3" alignItems="center" flexWrap="wrap">
              <Badge
                badgeType={isTestEndpoint ? 'success' : 'warning'}
                badgeSize="lg"
                testID={BinanceDepositTestIDs.environmentBadge}
              >
                <Badge.Text>
                  {isTestEndpoint ? 'TEST endpoint' : 'PROD endpoint'}
                </Badge.Text>
              </Badge>
              <Badge
                badgeType={isSignOnlyEnabled ? 'critical' : 'default'}
                badgeSize="lg"
              >
                <Badge.Text>
                  {isSignOnlyEnabled ? 'Sign only: ON' : 'Sign only: off'}
                </Badge.Text>
              </Badge>
            </XStack>
            {isTestEndpoint ? null : (
              <DepositHint>
                The deposit service may only be deployed in the test
                environment. Turn on the OneKey test endpoint under Developer
                settings &gt; Basic Info if every request fails.
              </DepositHint>
            )}
            {isSignOnlyEnabled ? (
              <Alert
                type="critical"
                title="Transfer disabled"
                description={BINANCE_DEPOSIT_SIGN_ONLY_TEXT}
              />
            ) : null}
            {isStateUnavailable ? (
              <Alert
                type="warning"
                title="Session state unavailable"
                description="The local session state could not be read from the background service. The page keeps retrying."
              />
            ) : null}
          </DepositSection>

          <DepositSection title="Sender">
            <Stack gap="$2">
              <DepositField label="Account" value={accountName || '-'} />
              <DepositField
                label="Address"
                value={senderText}
                tone={sender ? 'default' : 'critical'}
                testID={BinanceDepositTestIDs.senderAddress}
              />
              <DepositHint>
                The account selected on Home, resolved on the deposit network.
                It is fixed for a session once the session is created.
              </DepositHint>
              {canCreateAddress ? (
                <XStack>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={isBusy}
                    loading={busyAction === 'createAddress'}
                    onPress={actions.createAddress}
                    testID={BinanceDepositTestIDs.createAddressBtn}
                  >
                    Create address
                  </Button>
                </XStack>
              ) : null}
            </Stack>
          </DepositSection>

          <DepositSection
            title="Asset"
            headerRight={
              <Button
                size="small"
                variant="tertiary"
                disabled={assets.isLoading}
                onPress={() => void assets.reloadAssets()}
                testID={BinanceDepositTestIDs.reloadAssetsBtn}
              >
                Reload
              </Button>
            }
          >
            <Stack gap="$2">
              <Select
                title="Deposit network"
                placeholder="Select a network"
                items={networkItems}
                value={selectedNetworkId}
                onChange={(value) => {
                  if (value) {
                    assets.selectNetwork(value);
                  }
                }}
                disabled={networkItems.length === 0}
                testID={BinanceDepositTestIDs.networkSelect}
              />
              <Select
                title="Asset"
                placeholder="Select an asset"
                items={symbolItems}
                value={assets.symbol?.symbol}
                onChange={(value) => {
                  if (value) {
                    assets.selectSymbol(value);
                  }
                }}
                disabled={symbolItems.length === 0}
                testID={BinanceDepositTestIDs.symbolSelect}
              />
              {assets.loadFailed ? (
                <DepositHint tone="critical">
                  The deposit asset list could not be loaded. Reload to try
                  again.
                </DepositHint>
              ) : null}
              {!assets.loadFailed &&
              !assets.isLoading &&
              networkItems.length === 0 ? (
                <DepositHint tone="critical">
                  No asset is enabled for deposit right now.
                </DepositHint>
              ) : null}
              <DepositHint>
                Only used when a session is created. Contract:{' '}
                {assets.symbol?.contractAddress ?? 'native'}
              </DepositHint>
            </Stack>
          </DepositSection>

          <SessionSection
            session={active}
            networkName={
              active ? assets.networkNames[active.networkId] : undefined
            }
            now={now}
          />

          <DepositSection title="Actions">
            <XStack gap="$3" flexWrap="wrap">
              <Button
                size="small"
                variant="primary"
                disabled={
                  isBusy || !flags.canCreate || !sender || !assets.symbol
                }
                loading={busyAction === 'create'}
                onPress={actions.createSession}
                testID={BinanceDepositTestIDs.createSessionBtn}
              >
                Create session
              </Button>
              <Button
                size="small"
                variant="primary"
                disabled={isBusy || !flags.canOpenLink}
                loading={busyAction === 'openLink'}
                onPress={actions.openBinance}
                testID={BinanceDepositTestIDs.openBinanceBtn}
              >
                Open Binance
              </Button>
              <Button
                size="small"
                variant="secondary"
                disabled={isBusy || !flags.canRefresh}
                loading={busyAction === 'refresh'}
                onPress={actions.refreshSession}
                testID={BinanceDepositTestIDs.refreshBtn}
              >
                Refresh
              </Button>
              <Button
                size="small"
                variant="secondary"
                disabled={isBusy || !flags.canRetryCreate}
                loading={busyAction === 'retryCreate'}
                onPress={actions.retryCreate}
                testID={BinanceDepositTestIDs.retryCreateBtn}
              >
                Retry create
              </Button>
              <Button
                size="small"
                variant="destructive"
                disabled={isBusy || !flags.canAbandon}
                loading={busyAction === 'abandon'}
                onPress={actions.abandonSession}
                testID={BinanceDepositTestIDs.abandonBtn}
              >
                Abandon
              </Button>
            </XStack>
            {flags.isLive && !flags.isInProgress ? (
              <DepositHint>
                A new session can be created once this one is reported or
                abandoned.
              </DepositHint>
            ) : null}
          </DepositSection>

          {destination ? (
            <DestinationSection destination={destination} onCopy={handleCopy} />
          ) : null}

          {destination ? (
            <DepositSection title="Send">
              <Stack gap="$2">
                <Input
                  value={amount}
                  onChangeText={setAmount}
                  placeholder={`Amount in ${destination.cryptoCurrency}`}
                  keyboardType={AMOUNT_KEYBOARD_TYPE}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={canReviewSend}
                  testID={BinanceDepositTestIDs.amountInput}
                />
                <DepositHint
                  tone={amountFloor.ok ? 'default' : 'critical'}
                  testID={BinanceDepositTestIDs.minAmountHint}
                >
                  {describeBinanceDepositAmountFloor(amountFloor)}
                </DepositHint>
                <DepositHint>
                  Amounts below the minimum are blocked; there is no Max. Use a
                  dot as the decimal separator.
                </DepositHint>
                {flags.needsSendAttemptAck ? (
                  <Alert
                    type="critical"
                    title="An earlier transfer may already have been broadcast"
                    description={`Signing was allowed to start at ${formatBinanceDepositDateTime(
                      active?.sendAttemptedAt,
                    )} and no result was recorded for it. ${
                      isAckOnHold
                        ? `Signing and broadcasting may still be in progress: wait ${ackWaitSeconds}s, then check the history of the sender account.`
                        : 'Check the history of the sender account first.'
                    } Sending is off until you confirm below that the earlier transfer was not sent.`}
                    testID={BinanceDepositTestIDs.sendAttemptAlert}
                  />
                ) : null}
                {flags.needsSendAttemptAck ? (
                  <XStack>
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={isBusy || send.isPreparing || isAckOnHold}
                      loading={busyAction === 'ackSendAttempt'}
                      onPress={actions.acknowledgeSendAttempt}
                      testID={BinanceDepositTestIDs.ackSendAttemptBtn}
                    >
                      {isAckOnHold
                        ? `Wait ${ackWaitSeconds}s before confirming`
                        : 'I checked: the previous transfer was not sent'}
                    </Button>
                  </XStack>
                ) : null}
                <XStack>
                  <Button
                    size="small"
                    variant="primary"
                    disabled={!canReviewSend}
                    loading={send.isPreparing}
                    onPress={handleReviewSend}
                    testID={BinanceDepositTestIDs.reviewSendBtn}
                  >
                    Review &amp; send
                  </Button>
                </XStack>
                {send.notice ? (
                  <Alert
                    type={send.notice.type}
                    description={send.notice.text}
                    testID={BinanceDepositTestIDs.sendNotice}
                  />
                ) : null}
              </Stack>
            </DepositSection>
          ) : null}

          {active ? (
            <ReportSection
              report={active.report}
              canRetry={flags.canRetryReport}
              isRetrying={busyAction === 'retryReport'}
              isBusy={isBusy}
              onRetry={actions.retryReport}
              onCopy={handleCopy}
            />
          ) : null}

          <RecentSessionsSection
            sessions={state?.recent ?? []}
            isExpanded={isRecentExpanded}
            onToggle={handleToggleRecent}
          />

          <MemoEventsSection events={events} />
        </Page.Container>
      </Page.Body>
    </Page>
  );
}

function BinanceDepositUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Page>
      <Page.Header title={PAGE_TITLE} />
      <Page.Body>
        <Page.Container py="$4">
          <Alert
            type="warning"
            title={title}
            description={description}
            testID={BinanceDepositTestIDs.unavailableAlert}
          />
        </Page.Container>
      </Page.Body>
    </Page>
  );
}

function BinanceDepositHome() {
  const [devSettings] = useDevSettingsPersistAtom();
  // The return deep link only exists on iOS and Android; the route is
  // registered on every platform, so the page refuses to run elsewhere.
  if (!platformEnv.isNative) {
    return (
      <BinanceDepositUnavailable
        title="Not available on this platform"
        description="The Binance deposit self-test only runs in the iOS and Android apps."
      />
    );
  }
  // The only entry is under Developer settings, but a route can also be
  // opened by name (a server-driven page navigation needs nothing else), so
  // the page checks developer mode itself and mounts nothing without it.
  // `platformEnv.isDev` is deliberately not consulted: it is false in
  // production bundles, where this self-test has to work.
  if (!devSettings.enabled) {
    return (
      <BinanceDepositUnavailable
        title="Not available"
        description="The Binance deposit self-test is only available while developer mode is on."
      />
    );
  }
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <BinanceDepositHomeContent />
    </AccountSelectorProviderMirror>
  );
}

export default BinanceDepositHome;
