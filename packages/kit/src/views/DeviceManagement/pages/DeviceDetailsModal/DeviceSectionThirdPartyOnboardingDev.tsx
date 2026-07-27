import { useCallback, useState } from 'react';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDeviceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IThirdPartyAccountNameSourceStatus } from '@onekeyhq/shared/src/referralCode/type';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { ListItemGroup } from '../ListItemGroup';

type ILocalVerificationStatus = 'idle' | 'pending' | 'verified' | 'failed';
type INameSyncStatus = 'idle' | 'pending' | 'done' | 'failed';

function getErrorMessage(error: unknown, fallback: string): string {
  return (error instanceof Error ? error.message : '') || fallback;
}

function getVerificationFailureMessage(result: {
  success: boolean;
  payload: unknown;
}): string {
  const payload = result.payload as {
    code?: number | string;
    error?: string;
    message?: string;
    note?: string;
    verified?: boolean;
  };
  const detail = payload.error || payload.message;
  const code =
    payload.code === undefined ? '' : ` (code ${String(payload.code)})`;
  if (!result.success) {
    return detail
      ? `Device connection or verification failed${code}: ${detail}`
      : `Device connection or verification failed${code}`;
  }
  return (
    payload.error ||
    payload.note ||
    'The connected device did not pass the local genuine check.'
  );
}

function getNameSourceStatusMessage(
  status: IThirdPartyAccountNameSourceStatus,
): string {
  const messages: Record<IThirdPartyAccountNameSourceStatus, string> = {
    available: 'The source was read, but no account needs to be renamed.',
    no_matches: 'No OneKey account address matched the source accounts.',
    source_not_found:
      'Ledger Live account data was not found on this computer.',
    encrypted_source:
      'The local account source is encrypted and cannot be read directly.',
    cloud_source_requires_authorization:
      'This source requires authorization and is not enabled in this test.',
    unsupported_source: 'This source is not supported on the current platform.',
    invalid_source: 'The local account source could not be parsed safely.',
  };
  return messages[status];
}

function DeviceSectionThirdPartyOnboardingDev() {
  const [device] = useDeviceAtom();
  const [verificationStatus, setVerificationStatus] =
    useState<ILocalVerificationStatus>('idle');
  const [verificationError, setVerificationError] = useState('');
  const [nameSyncStatus, setNameSyncStatus] = useState<INameSyncStatus>('idle');
  const [nameSyncError, setNameSyncError] = useState('');
  const [renamedCount, setRenamedCount] = useState(0);

  const vendor = device?.vendor;
  const isThirdParty =
    vendor === EHardwareVendor.trezor || vendor === EHardwareVendor.ledger;

  const handleLocalVerify = useCallback(async () => {
    if (!device || !isThirdParty || verificationStatus === 'pending') {
      return;
    }
    setVerificationStatus('pending');
    setVerificationError('');
    try {
      const connectId =
        device.usbConnectId || device.connectId || device.bleConnectId;
      if (!connectId) {
        throw new OneKeyLocalError(
          'Reconnect this device before running the genuine check.',
        );
      }
      // Intentionally omit a OneKey relay URL and reward challenge:
      // Trezor returns a local attestation proof; Ledger uses its direct
      // Genuine Check flow. This is diagnostic evidence, not coupon authority.
      const result =
        await backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareVerifyDeviceAuthenticity(
          {
            vendor,
            connectId,
            dbDeviceId: device.id,
          },
        );
      const payload = result.payload as { verified?: boolean };
      if (!result.success || payload.verified !== true) {
        throw new OneKeyLocalError(getVerificationFailureMessage(result));
      }
      setVerificationStatus('verified');
      Dialog.show({
        icon: 'BadgeVerifiedSolid',
        title: 'Real device authenticity passed',
        description: [
          vendor === EHardwareVendor.trezor
            ? 'Trezor attestation passed with a fresh local challenge.'
            : 'Ledger Genuine Check passed through the vendor service.',
          '',
          'Physical-device check: real',
          'OneKey server challenge: not requested',
          'Wallet address signature: not requested',
          'OneKey reward claim: not requested',
          '',
          'This diagnostic proof cannot be reused for a later claim. The production reward flow must start with a fresh server challenge.',
        ].join('\n'),
        onConfirmText: 'Done',
      });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Local device verification failed',
      );
      setVerificationStatus('failed');
      setVerificationError(message);
      Toast.error({
        title: message,
      });
    }
  }, [device, isThirdParty, vendor, verificationStatus]);

  const handleNameSync = useCallback(async () => {
    if (!device || !isThirdParty || nameSyncStatus === 'pending') {
      return;
    }
    setNameSyncStatus('pending');
    setNameSyncError('');
    try {
      const result =
        await backgroundApiProxy.serviceThirdPartyHardware.getThirdPartyGlobalAccountNameCandidates(
          {
            vendor,
            dbDeviceId: device.id,
          },
        );
      if (result.status !== 'available' || result.candidates.length === 0) {
        setNameSyncStatus('idle');
        Dialog.show({
          icon: 'InfoCircleOutline',
          title: 'No names to sync',
          description: getNameSourceStatusMessage(result.status),
          onConfirmText: 'Done',
        });
        return;
      }
      const authorizationId = result.authorizationId;
      if (!authorizationId) {
        throw new OneKeyLocalError(
          'The account name matches were not authorized by the background service.',
        );
      }

      const preview = result.candidates
        .slice(0, 8)
        .map(
          (candidate) =>
            `${candidate.currentName} → ${candidate.sourceName}\n${candidate.matchedAddress}`,
        );
      if (result.candidates.length > preview.length) {
        preview.push(
          `…and ${result.candidates.length - preview.length} more account(s)`,
        );
      }
      setNameSyncStatus('idle');
      Dialog.show({
        icon: 'EditOutline',
        title: `Sync ${result.candidates.length} account name(s)?`,
        description: [
          vendor === EHardwareVendor.ledger
            ? 'Ledger Live was read locally. Every OneKey account was scanned; only exact address matches are listed.'
            : 'The connected Trezor derived BTC receive addresses. Matching OneKey accounts use Trezor Suite default titles.',
          '',
          ...preview,
        ].join('\n'),
        onCancelText: 'Cancel',
        onConfirmText: 'Sync names',
        onCancel: () => setNameSyncStatus('idle'),
        onConfirm: async ({ close }) => {
          setNameSyncStatus('pending');
          try {
            const applied =
              await backgroundApiProxy.serviceThirdPartyHardware.applyThirdPartyGlobalAccountNames(
                {
                  authorizationId,
                },
              );
            setRenamedCount(applied.renamed);
            setNameSyncStatus('done');
            Toast.success({
              title: `Synced ${applied.renamed} account name(s)`,
            });
            await close?.();
          } catch (error) {
            setNameSyncStatus('failed');
            Toast.error({
              title:
                (error instanceof Error ? error.message : '') ||
                'Account name sync failed',
            });
          }
        },
      });
    } catch (error) {
      const message = getErrorMessage(error, 'Could not read account names');
      setNameSyncStatus('failed');
      setNameSyncError(message);
      Toast.error({
        title: message,
      });
    }
  }, [device, isThirdParty, nameSyncStatus, vendor]);

  if (!device || !isThirdParty) {
    return null;
  }

  const verifySubtitle = {
    idle:
      vendor === EHardwareVendor.trezor
        ? 'Run real Trezor attestation locally; the OneKey reward API is not called'
        : 'Run real Ledger Genuine Check; the OneKey reward API is not called',
    pending: 'Waiting for the connected device…',
    verified: 'Real device check passed · server reward flow not tested',
    failed: verificationError || 'Failed · tap to retry',
  }[verificationStatus];
  const nameSyncSubtitle = {
    idle:
      vendor === EHardwareVendor.ledger
        ? 'Read Ledger Live locally and match every OneKey account by address'
        : 'Match the standard Trezor BTC wallet by deriving empty-passphrase addresses',
    pending: 'Reading source accounts and matching addresses…',
    done: `Done · renamed ${renamedCount} account(s)`,
    failed: nameSyncError || 'Failed · tap to retry',
  }[nameSyncStatus];

  return (
    <ListItemGroup
      withSeparator
      itemProps={{ minHeight: '$12' }}
      title="Developer · Third-party onboarding"
    >
      <ListItem
        icon="LinkOutline"
        title="1. Pair, verify, and mock voucher"
        subtitle={verifySubtitle}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        isLoading={verificationStatus === 'pending'}
        disabled={verificationStatus === 'pending'}
        onPress={handleLocalVerify}
        testID="third-party-onboarding-local-verify"
      />
      <ListItem
        icon="EditOutline"
        title="2. Sync account names by address"
        subtitle={nameSyncSubtitle}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        isLoading={nameSyncStatus === 'pending'}
        disabled={nameSyncStatus === 'pending'}
        onPress={handleNameSync}
        testID="third-party-onboarding-name-sync"
      />
    </ListItemGroup>
  );
}

export default DeviceSectionThirdPartyOnboardingDev;
