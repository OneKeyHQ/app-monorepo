import { useMemo } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { privacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/privacyChain';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PRIVACY_CHAIN_SYNC_POLL_MS } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

export function ReceivePrivacyStatus({
  state,
  onEnableMobileData,
}: {
  state:
    | 'preparing'
    | 'syncing'
    | 'waitingWifi'
    | 'synced'
    | 'paused'
    | 'error';
  onEnableMobileData?: () => void;
}) {
  const intl = useIntl();
  if (state === 'preparing' || state === 'syncing' || state === 'synced')
    return null;
  const label = {
    waitingWifi: ETranslations.privacy_sync_waiting_wifi__msg,
    paused: ETranslations.syncing_paused__title,
    error: ETranslations.privacy_sync_failed_retrying__msg,
  }[state];
  return (
    <YStack
      testID="receive-privacy-status"
      bg="$bgSubdued"
      p="$3"
      gap="$2"
      borderRadius="$3"
    >
      <XStack gap="$2" alignItems="center">
        <Icon
          name={
            state === 'waitingWifi' || state === 'paused'
              ? 'PauseOutline'
              : 'RefreshCcwOutline'
          }
          size="$4"
          color="$iconSubdued"
        />
        <SizableText size="$bodySmMedium" flex={1}>
          {intl.formatMessage({ id: label })}
        </SizableText>
      </XStack>
      {state === 'waitingWifi' && onEnableMobileData ? (
        <Button
          testID="receive-privacy-allow-mobile-data"
          size="small"
          alignSelf="flex-start"
          onPress={onEnableMobileData}
        >
          {intl.formatMessage({
            id: ETranslations.privacy_sync_mobile_data__title,
          })}
        </Button>
      ) : null}
    </YStack>
  );
}

export function ReceivePrivacySyncStatus({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const intl = useIntl();
  const scope = `${networkId}:${accountId}`;
  const stateAtom = useMemo(
    () =>
      selectAtom(
        privacyChainAtom.atom(),
        (value) => ({
          held: value.dataBlockedNetworkIds.includes(networkId),
          paused: value.pausedNetworkIds.includes(networkId),
          error: value.syncErrorByNetworkId[networkId],
        }),
        isEqual,
      ),
    [networkId],
  );
  const syncState = useAtomValue(stateAtom);
  const { result } = usePromiseResult(
    async () => {
      try {
        return {
          scope,
          progress:
            await backgroundApiProxy.servicePrivacyChain.getLocalWalletSyncProgress(
              { networkId, accountId },
            ),
          failed: false,
        };
      } catch {
        return { scope, progress: undefined, failed: true };
      }
    },
    [scope, networkId, accountId],
    { pollingInterval: PRIVACY_CHAIN_SYNC_POLL_MS },
  );
  const currentResult = result?.scope === scope ? result : undefined;
  const progress = currentResult?.progress;
  let state: React.ComponentProps<typeof ReceivePrivacyStatus>['state'] =
    'preparing';
  if (syncState.held) state = 'waitingWifi';
  else if (syncState.paused) state = 'paused';
  else if (syncState.error || currentResult?.failed) state = 'error';
  else if (progress?.isBackfillComplete && progress.isTipCaughtUp)
    state = 'synced';
  else if (progress) state = 'syncing';
  return (
    <ReceivePrivacyStatus
      state={state}
      onEnableMobileData={() => {
        void backgroundApiProxy.servicePrivacyChain
          .setAllowCellularSync({ allow: true })
          .catch(() =>
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              }),
            }),
          );
      }}
    />
  );
}
