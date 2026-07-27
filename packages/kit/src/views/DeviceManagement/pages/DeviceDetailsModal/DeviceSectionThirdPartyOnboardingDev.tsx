import { useCallback, useState } from 'react';

import {
  Dialog,
  ScrollView,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDeviceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IThirdPartyAccountNameSourceInventoryAccount,
  IThirdPartyAccountNameSourceStatus,
} from '@onekeyhq/shared/src/referralCode/type';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { ListItemGroup } from '../ListItemGroup';

// cspell:ignore DSID
type ILocalVerificationStatus = 'idle' | 'pending' | 'verified' | 'failed';
type INameSyncStatus = 'idle' | 'pending' | 'done' | 'failed';

function getErrorMessage(error: unknown, fallback: string): string {
  return (error instanceof Error ? error.message : '') || fallback;
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

function AccountNameSourceInventory({
  accounts,
  scopeDescription,
}: {
  accounts: IThirdPartyAccountNameSourceInventoryAccount[];
  scopeDescription: string;
}) {
  return (
    <ScrollView maxHeight={480}>
      <YStack gap="$3">
        <SizableText size="$bodySm" color="$textSubdued">
          {scopeDescription}
        </SizableText>
        {accounts.map((account, index) => (
          <YStack
            key={`${account.source}:${account.path || account.address}:${index}`}
            gap="$1"
            pb="$3"
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
          >
            <XStack justifyContent="space-between" gap="$3">
              <SizableText flex={1} size="$bodyMdMedium">
                {account.sourceName}
              </SizableText>
              <SizableText
                size="$bodySm"
                color={
                  account.matchedOneKeyAccounts.length
                    ? '$textSuccess'
                    : '$textSubdued'
                }
              >
                {account.matchedOneKeyAccounts.length
                  ? `${account.matchedOneKeyAccounts.length} match`
                  : 'No match'}
              </SizableText>
            </XStack>
            {account.path ? (
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                {account.path}
              </SizableText>
            ) : null}
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              {account.address}
            </SizableText>
            {account.matchedOneKeyAccounts.map((match) => (
              <SizableText
                key={match.indexedAccountId}
                size="$bodySm"
                color="$textSuccess"
              >
                OneKey: {match.currentName}
              </SizableText>
            ))}
          </YStack>
        ))}
      </YStack>
    </ScrollView>
  );
}

function DeviceSectionThirdPartyOnboardingDev() {
  const [device] = useDeviceAtom();
  const [verificationStatus, setVerificationStatus] =
    useState<ILocalVerificationStatus>('idle');
  const [verificationError, setVerificationError] = useState('');
  const [nameSyncStatus, setNameSyncStatus] = useState<INameSyncStatus>('idle');
  const [nameSyncError, setNameSyncError] = useState('');
  const [sourceAccountCount, setSourceAccountCount] = useState(0);

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
      const result =
        await backgroundApiProxy.serviceThirdPartyHardware.runLocalMockThirdPartyDeviceClaim(
          {
            vendor,
            connectId,
            dbDeviceId: device.id,
          },
        );
      setVerificationStatus('verified');
      Dialog.show({
        icon: 'BadgeVerifiedSolid',
        title: 'Local mock claim issued',
        description: [
          vendor === EHardwareVendor.trezor
            ? 'Trezor signed a fresh local mock-server challenge. The mock backend independently reverified the raw certificate/signature proof.'
            : 'Ledger passed the official vendor Genuine Check. This validates the device integration, but production still requires a OneKey relay.',
          '',
          `Verification mode: ${result.verificationMode}`,
          `Device DSID: ${result.deviceId}`,
          `Challenge: ${result.challengeHex}`,
          `Mock voucher: ${result.voucherCode}`,
          '',
          result.serverPortable
            ? 'The Trezor verifier and evidence DTO can move to the backend unchanged; the backend must generate its own fresh challenge.'
            : 'The Ledger client verdict cannot move to the backend as proof. The production backend must witness the same Genuine Check session through its relay.',
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

  const handleNameInventory = useCallback(async () => {
    if (!device || !isThirdParty || nameSyncStatus === 'pending') {
      return;
    }
    setNameSyncStatus('pending');
    setNameSyncError('');
    try {
      const result =
        await backgroundApiProxy.serviceThirdPartyHardware.getThirdPartyGlobalAccountNameSourceInventory(
          {
            vendor,
            dbDeviceId: device.id,
          },
        );
      if (result.status !== 'available' || result.accounts.length === 0) {
        setNameSyncStatus('idle');
        Dialog.show({
          icon: 'InfoCircleOutline',
          title: 'No source accounts found',
          description: getNameSourceStatusMessage(result.status),
          onConfirmText: 'Done',
        });
        return;
      }
      setSourceAccountCount(result.accounts.length);
      setNameSyncStatus('done');
      Dialog.show({
        icon: 'EditOutline',
        title: `${vendor === EHardwareVendor.ledger ? 'Ledger Live' : 'Trezor'} source accounts (${result.accounts.length})`,
        description:
          'Read-only developer view. Nothing is renamed from this window.',
        renderContent: (
          <AccountNameSourceInventory
            accounts={result.accounts}
            scopeDescription={result.scopeDescription}
          />
        ),
        onConfirmText: 'Done',
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
        ? 'Mock the backend locally; sign and independently verify a real Trezor proof'
        : 'Mock the backend locally; run the real Ledger vendor Genuine Check',
    pending: 'Waiting for the connected device…',
    verified: 'Real device proof accepted · local DEV voucher issued',
    failed: verificationError || 'Failed · tap to retry',
  }[verificationStatus];
  const nameSyncSubtitle = {
    idle:
      vendor === EHardwareVendor.ledger
        ? 'Show every plaintext Ledger Live Ethereum name/address and its OneKey matches'
        : 'Show 40 standard Trezor BTC receive addresses, paths, titles, and OneKey matches',
    pending: 'Reading every bounded source account and matching addresses…',
    done: `Read-only list ready · ${sourceAccountCount} source account(s)`,
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
        title="1. Local mock claim with real device proof"
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
        title="2. View all source accounts and address matches"
        subtitle={nameSyncSubtitle}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        isLoading={nameSyncStatus === 'pending'}
        disabled={nameSyncStatus === 'pending'}
        onPress={handleNameInventory}
        testID="third-party-onboarding-name-sync"
      />
    </ListItemGroup>
  );
}

export default DeviceSectionThirdPartyOnboardingDev;
