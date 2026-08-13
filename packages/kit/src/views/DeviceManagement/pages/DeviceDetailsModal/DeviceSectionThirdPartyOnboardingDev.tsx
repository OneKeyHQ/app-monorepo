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
import { showThirdPartyAccountNameSyncDialog } from '@onekeyhq/kit/src/views/Onboardingv2/components/ThirdPartyDevicePostAddDialog';
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

type ILocalVerificationStatus = 'idle' | 'pending' | 'verified' | 'failed';
type INameSyncStatus = 'idle' | 'pending' | 'done' | 'failed';

function getErrorMessage(error: unknown, fallback: string): string {
  return (error instanceof Error ? error.message : '') || fallback;
}

function getNetworkDisplayName(networkImpl: string, networkName: string) {
  if (networkImpl === 'btc') {
    return '比特币';
  }
  if (networkImpl === 'evm') {
    return '以太坊兼容网络';
  }
  return networkName;
}

function getNameSourceStatusMessage(
  status: IThirdPartyAccountNameSourceStatus,
): string {
  const messages: Record<IThirdPartyAccountNameSourceStatus, string> = {
    available: '已读取来源账户，但没有需要重命名的账户。',
    no_matches: '没有 OneKey 账户地址与来源账户匹配。',
    source_not_found: '未在这台电脑上找到对应钱包应用的账户数据。',
    encrypted_source: '本地账户数据已加密，无法直接读取。',
    cloud_source_requires_authorization:
      '该账户来源需要授权，本次测试尚未启用。',
    unsupported_source: '当前平台不支持读取该账户来源。',
    invalid_source:
      '已找到本地钱包数据，但 OneKey 无法安全读取。请关闭钱包应用后重试。',
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
    vendor === EHardwareVendor.trezor ? '比特币' : '以太坊';
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
              当前选择的 OneKey 设备
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              数据库设备标识：{selectedDevice.dbDeviceId}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              已保存的设备标识：{selectedDevice.deviceId}
            </SizableText>
            {selectedDevice.featuresDeviceId ? (
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                设备上报标识：{selectedDevice.featuresDeviceId}
              </SizableText>
            ) : null}
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              主连接标识：{selectedDevice.connectId || '（空）'}
            </SizableText>
            {selectedDevice.usbConnectId ? (
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                USB 连接标识：{selectedDevice.usbConnectId}
              </SizableText>
            ) : null}
            {selectedDevice.bleConnectId ? (
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                蓝牙连接标识：{selectedDevice.bleConnectId}
              </SizableText>
            ) : null}
          </YStack>
        ) : null}
        <SizableText size="$bodyMdMedium">
          {sourceWalletName} 账户（{accounts.length}）
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
                {sourceWalletName} 名称：{account.sourceName}
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
                  ? `匹配到 ${account.matchedOneKeyAccounts.length} 个 OneKey 账户`
                  : '没有匹配'}
              </SizableText>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {sourceWalletName} 链：{sourceChainName}
            </SizableText>
            {account.path ? (
              <SizableText size="$bodySm" color="$textSubdued" selectable>
                {sourceWalletName} 路径：{account.path}
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
                Suite 设备标识：{account.sourceDeviceId}
                {account.selectedDeviceMatch ? ' · 当前设备' : ''}
              </SizableText>
            ) : null}
            {account.sourceAccountType ? (
              <SizableText size="$bodySm" color="$textSubdued">
                账户类型：{account.sourceAccountType}
              </SizableText>
            ) : null}
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              {sourceWalletName} 地址：{account.address}
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
                  OneKey 账户名称：{match.currentName}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  OneKey 钱包：{match.walletName}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  钱包标识：{match.walletId}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  OneKey 链：
                  {getNetworkDisplayName(match.networkImpl, match.networkName)}
                  （{match.networkId}）
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  OneKey 地址：{match.address}
                </SizableText>
                {match.path ? (
                  <SizableText size="$bodySm" color="$textSubdued" selectable>
                    OneKey 路径：{match.path}
                  </SizableText>
                ) : null}
              </YStack>
            ))}
          </YStack>
        ))}
        <SizableText size="$bodyMdMedium">
          OneKey 钱包（{localWalletGroups.length}）· 地址记录（
          {localAccounts.length}）
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
              OneKey 钱包：{wallet.walletName}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" selectable>
              钱包标识：{wallet.walletId}
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
                  {getNetworkDisplayName(
                    account.networkImpl,
                    account.networkName,
                  )}
                  （{account.networkId}）
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  当前 OneKey 名称：{account.currentName}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued" selectable>
                  地址：{account.address}
                </SizableText>
                {account.path ? (
                  <SizableText size="$bodySm" color="$textSubdued" selectable>
                    OneKey 路径：{account.path}
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
  const [nameDialogPending, setNameDialogPending] = useState(false);

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
        throw new OneKeyLocalError('请重新连接设备后再执行设备验真。');
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
        title: '本地设备验真通过',
        description: [
          vendor === EHardwareVendor.trezor
            ? 'SDK 已让当前连接的 Trezor 对全新挑战值完成认证，并通过原厂验真。'
            : '应用内置的本地模拟服务已完成 Ledger 官方原厂验真，并获取物理设备的原厂验真标识。',
          '',
          `验真方式：${
            result.verificationMode === 'trezor-sdk-genuine-check'
              ? 'Trezor 官方原厂验真'
              : 'Ledger 官方原厂验真'
          }`,
          `原厂设备验真标识：${result.deviceId}`,
          vendor === EHardwareVendor.trezor
            ? `挑战值：${result.challengeHex}`
            : `本地领取随机数：${result.challengeHex}`,
          `测试券码：${result.voucherCode}`,
          '',
          '这只是本地集成测试。正式环境必须由服务端发起或见证设备验真，验真通过后才能发放真实优惠券。',
        ].join('\n'),
        onConfirmText: '完成',
      });
    } catch (error) {
      const message = getErrorMessage(error, '本地设备验真失败');
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
        title: `${
          vendor === EHardwareVendor.ledger ? 'Ledger Live' : 'Trezor Suite'
        } 来源账户（${result.accounts.length}）`,
        description: [
          '开发者只读视图。本窗口不会修改任何账户名称。',
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
        onConfirmText: '完成',
      });
    } catch (error) {
      const message = getErrorMessage(error, '无法读取账户名称');
      setNameSyncStatus('failed');
      setNameSyncError(message);
      Toast.error({
        title: ETranslations.global_an_error_occurred,
      });
    }
  }, [device, isThirdParty, nameSyncStatus, vendor]);

  const handlePreviewNameSyncDialog = useCallback(async () => {
    if (!device || !isThirdParty || nameDialogPending) {
      return;
    }
    setNameDialogPending(true);
    try {
      const walletsWithDevice =
        await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
          filterHiddenWallet: true,
          skipDuplicateDeviceSameType: true,
        });
      const matched = Object.values(walletsWithDevice).find(
        (entry) => entry.device?.id === device.id,
      );
      if (!matched?.wallet) {
        Toast.error({ title: '未找到该设备对应的钱包' });
        return;
      }
      const outcome = await showThirdPartyAccountNameSyncDialog({
        wallet: matched.wallet,
        vendor:
          vendor === EHardwareVendor.trezor
            ? ('trezor' as const)
            : ('ledger' as const),
      });
      if (!outcome.shown) {
        Toast.message({
          title: `未弹出弹窗 · ${outcome.status}`,
        });
      }
    } catch (error) {
      Toast.error({
        title: getErrorMessage(error, '无法打开账户名称同步弹窗'),
      });
    } finally {
      setNameDialogPending(false);
    }
  }, [device, isThirdParty, nameDialogPending, vendor]);

  if (!device || !isThirdParty) {
    return null;
  }

  const verifySubtitle = {
    idle:
      vendor === EHardwareVendor.trezor
        ? '使用全新挑战值执行真实的 Trezor 官方原厂验真'
        : '执行真实的 Ledger 官方原厂验真并读取原厂设备验真标识',
    pending: '正在等待设备响应…',
    verified: '真实设备证明已通过 · 已生成本地测试券',
    failed: verificationError || '验真失败 · 点按重试',
  }[verificationStatus];
  const nameSyncSubtitle = {
    idle:
      vendor === EHardwareVendor.ledger
        ? '显示 Ledger Live 中全部明文以太坊名称、地址及其 OneKey 匹配结果'
        : '读取 Trezor Suite 本地比特币账户和设备标识，不从硬件派生地址',
    pending: '正在读取本地钱包应用数据并匹配地址…',
    done: `只读清单已生成 · ${sourceAccountCount} 个来源账户`,
    failed: nameSyncError || '读取失败 · 点按重试',
  }[nameSyncStatus];

  return (
    <ListItemGroup
      withSeparator
      itemProps={{ minHeight: '$12' }}
      title="开发者调试 · 第三方硬件接入"
    >
      <ListItem
        icon="LinkOutline"
        title="1. 本地模拟领取（真实设备验真）"
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
            ? '2. 对比 Trezor Suite 比特币账户名称'
            : '2. 对比 Ledger Live 以太坊账户名称'
        }
        subtitle={nameSyncSubtitle}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        isLoading={nameSyncStatus === 'pending'}
        disabled={nameSyncStatus === 'pending'}
        onPress={handleNameInventory}
        testID="third-party-onboarding-name-sync"
      />
      <ListItem
        icon="PlayOutline"
        title="3. 预览账户名称同步弹窗"
        subtitle={
          vendor === EHardwareVendor.ledger
            ? '打开建钱包后的那个同步弹窗：默认全部勾选，一个地址对应多个名称时可选择'
            : 'Trezor Suite 的账户名称在云端加密文件里，读不到，弹窗会提示原因'
        }
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        isLoading={nameDialogPending}
        disabled={nameDialogPending}
        onPress={handlePreviewNameSyncDialog}
        testID="third-party-onboarding-name-sync-preview"
      />
    </ListItemGroup>
  );
}

export default DeviceSectionThirdPartyOnboardingDev;
