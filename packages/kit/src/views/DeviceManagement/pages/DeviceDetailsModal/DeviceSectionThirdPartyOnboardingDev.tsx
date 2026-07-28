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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IThirdPartyAccountNameLocalAccount,
  IThirdPartyAccountNameSelectedDevice,
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
      'The wallet application account data was not found on this computer.',
    encrypted_source:
      'The local account source is encrypted and cannot be read directly.',
    cloud_source_requires_authorization:
      'This source requires authorization and is not enabled in this test.',
    unsupported_source: 'This source is not supported on the current platform.',
    invalid_source:
      'The local wallet data was found, but OneKey could not read it safely. Close the wallet application and retry.',
  };
  return messages[status];
}

function AccountNameSourceInventory({
  vendor,
  accounts,
  localAccounts,
  selectedDevice,
  scopeDescription,
}: {
  vendor: EHardwareVendor.trezor | EHardwareVendor.ledger;
  accounts: IThirdPartyAccountNameSourceInventoryAccount[];
  localAccounts: IThirdPartyAccountNameLocalAccount[];
  selectedDevice?: IThirdPartyAccountNameSelectedDevice;
  scopeDescription: string;
}) {
  const sourceWalletName =
    vendor === EHardwareVendor.trezor ? 'Trezor Suite' : 'Ledger Live';
  const sourceChainName =
    vendor === EHardwareVendor.trezor ? 'Bitcoin' : 'Ethereum';
  const localWalletGroups = localAccounts.reduce<
    Array<{
      walletId: string;
      walletName: string;
      accounts: IThirdPartyAccountNameLocalAccount[];
    }>
  >((groups, account) => {
    let group = groups.find((item) => item.walletId === account.walletId);
    if (!group) {
      group = {
        walletId: account.walletId,
        walletName: account.walletName,
        accounts: [],
      };
      groups.push(group);
    }
    group.accounts.push(account);
    return groups;
  }, []);

  return (
    <ScrollView maxHeight={480}>
      <YStack gap="$3">
        <SizableText size="$bodySm" color="$textSubdued">
          {scopeDescription}
        </SizableText>
        {selectedDevice ? (
          <YStack
            gap="$1"
            p="$3"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$3"
          >
            <SizableText size="$bodyMdMedium">
              Selected OneKey device
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              DB device id: {selectedDevice.dbDeviceId}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              Stored deviceId: {selectedDevice.deviceId}
            </SizableText>
            {selectedDevice.featuresDeviceId ? (
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                Features device_id: {selectedDevice.featuresDeviceId}
              </SizableText>
            ) : null}
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              Primary connectId: {selectedDevice.connectId || '(empty)'}
            </SizableText>
            {selectedDevice.usbConnectId ? (
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                USB connectId: {selectedDevice.usbConnectId}
              </SizableText>
            ) : null}
            {selectedDevice.bleConnectId ? (
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                BLE connectId: {selectedDevice.bleConnectId}
              </SizableText>
            ) : null}
          </YStack>
        ) : null}
        <SizableText size="$bodyMdMedium">
          {sourceWalletName} accounts ({accounts.length})
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
                {sourceWalletName} name: {account.sourceName}
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
                  ? `${account.matchedOneKeyAccounts.length} OneKey match`
                  : 'No match'}
              </SizableText>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {sourceWalletName} chain: {sourceChainName}
            </SizableText>
            {account.path ? (
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                {sourceWalletName} path: {account.path}
              </SizableText>
            ) : null}
            {account.sourceDeviceId ? (
              <SizableText
                size="$bodySm"
                color={
                  account.selectedDeviceMatch ? '$textSuccess' : '$textSubdued'
                }
                selectable
              >
                Suite deviceId: {account.sourceDeviceId}
                {account.selectedDeviceMatch ? ' · selected device' : ''}
              </SizableText>
            ) : null}
            {account.sourceAccountType ? (
              <SizableText size="$bodySm" color="$textSubdued">
                Account type: {account.sourceAccountType}
              </SizableText>
            ) : null}
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              {sourceWalletName} address: {account.address}
            </SizableText>
            {account.matchedOneKeyAccounts.map((match) => (
              <YStack
                key={`${match.accountId}:${match.networkId}:${match.address}`}
                gap="$0.5"
                mt="$1"
                pl="$2"
                borderLeftWidth="$px"
                borderLeftColor="$borderSuccess"
              >
                <SizableText size="$bodySm" color="$textSuccess">
                  OneKey account name: {match.currentName}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  OneKey wallet: {match.walletName}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  Wallet ID: {match.walletId}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  OneKey chain: {match.networkName} ({match.networkId})
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  OneKey address: {match.address}
                </SizableText>
                {match.path ? (
                  <SizableText size="$bodySm" color="$textSubdued" selectable>
                    OneKey path: {match.path}
                  </SizableText>
                ) : null}
              </YStack>
            ))}
          </YStack>
        ))}
        <SizableText size="$bodyMdMedium">
          OneKey wallets ({localWalletGroups.length}) · address records (
          {localAccounts.length})
        </SizableText>
        {localWalletGroups.map((wallet) => (
          <YStack
            key={wallet.walletId}
            gap="$2"
            p="$3"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$3"
          >
            <SizableText size="$bodyMdMedium">
              OneKey wallet: {wallet.walletName}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              Wallet ID: {wallet.walletId}
            </SizableText>
            {wallet.accounts.map((account) => (
              <YStack
                key={`${account.accountId}:${account.networkId}:${account.address}`}
                gap="$0.5"
                pt="$2"
                borderTopWidth="$px"
                borderTopColor="$borderSubdued"
              >
                <SizableText size="$bodySmMedium">
                  {account.networkName} ({account.networkId})
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  Current OneKey name: {account.currentName}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  Address: {account.address}
                </SizableText>
                {account.path ? (
                  <SizableText size="$bodySm" color="$textSubdued" selectable>
                    OneKey path: {account.path}
                  </SizableText>
                ) : null}
              </YStack>
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
      // Ledger USB connectIds are per-session UUIDs. Passing no target lets
      // the SDK reuse its one active session, or safely discover the sole
      // attached Ledger after an app restart instead of chasing a stale DB id.
      const connectId =
        vendor === EHardwareVendor.ledger
          ? ''
          : device.usbConnectId ||
            device.connectId ||
            device.bleConnectId ||
            '';
      if (!connectId && vendor !== EHardwareVendor.ledger) {
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
        title: 'Local device check passed',
        description: [
          vendor === EHardwareVendor.trezor
            ? 'The SDK asked the connected Trezor to authenticate a fresh challenge and accepted its genuine-check result.'
            : 'The local OneKey DMK server drove Ledger’s official Genuine Check through the SDK’s existing device session and captured the physical-device DSID.',
          '',
          `Verification mode: ${result.verificationMode}`,
          `Device DSID: ${result.deviceId}`,
          vendor === EHardwareVendor.trezor
            ? `Challenge: ${result.challengeHex}`
            : `Client claim nonce: ${result.challengeHex}`,
          `Mock voucher: ${result.voucherCode}`,
          '',
          'This is only a local integration check. The production backend must own or witness its own verification before issuing a real voucher.',
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
      setSourceAccountCount(result.accounts.length);
      setNameSyncStatus(result.status === 'available' ? 'done' : 'idle');
      Dialog.show({
        icon:
          result.status === 'available' ? 'EditOutline' : 'InfoCircleOutline',
        title: `${vendor === EHardwareVendor.ledger ? 'Ledger Live' : 'Trezor Suite'} source accounts (${result.accounts.length})`,
        description: [
          'Read-only developer view. Nothing is renamed from this window.',
          result.status === 'available'
            ? ''
            : getNameSourceStatusMessage(result.status),
        ]
          .filter(Boolean)
          .join('\n'),
        renderContent: (
          <AccountNameSourceInventory
            vendor={vendor}
            accounts={result.accounts}
            localAccounts={result.localAccounts}
            selectedDevice={result.selectedDevice}
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
        title: ETranslations.global_an_error_occurred,
      });
    }
  }, [device, isThirdParty, nameSyncStatus, vendor]);

  if (!device || !isThirdParty) {
    return null;
  }

  const verifySubtitle = {
    idle:
      vendor === EHardwareVendor.trezor
        ? 'Run the real Trezor SDK genuine check with a fresh challenge'
        : 'Run the real Ledger vendor Genuine Check and read its DSID',
    pending: 'Waiting for the connected device…',
    verified: 'Real device proof accepted · local DEV voucher issued',
    failed: verificationError || 'Failed · tap to retry',
  }[verificationStatus];
  const nameSyncSubtitle = {
    idle:
      vendor === EHardwareVendor.ledger
        ? 'Show every plaintext Ledger Live Ethereum name/address and its OneKey matches'
        : 'Read Trezor Suite local BTC accounts and deviceId; no hardware address derivation',
    pending: 'Reading local wallet application data and matching addresses…',
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
        title={
          vendor === EHardwareVendor.trezor
            ? '2. Compare Trezor Suite Bitcoin names'
            : '2. Compare Ledger Live Ethereum names'
        }
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
