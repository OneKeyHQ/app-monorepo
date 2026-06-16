import { useCallback, useState } from 'react';

import {
  Button,
  Input,
  SizableText,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

// Native SUI coin type used in move call type arguments.
const SUI_NATIVE_COIN_TYPE = '0x2::sui::SUI';

function SuiDemo() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const networkId = activeAccount.network?.id ?? '';
  const accountId = activeAccount.account?.id ?? '';
  const ownAddress = activeAccount.account?.address ?? '';

  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('0.01');
  const [coinType, setCoinType] = useState(SUI_NATIVE_COIN_TYPE);

  const isSui = networkId === getNetworkIdsMap().sui;
  const to = recipient.trim() || ownAddress;

  const guard = useCallback(() => {
    if (!accountId || !networkId) {
      Toast.error({ title: 'No active account' });
      return false;
    }
    if (!isSui) {
      Toast.error({ title: `Switch to Sui first (current: ${networkId})` });
      return false;
    }
    return true;
  }, [accountId, networkId, isSui]);

  // transfersInfo drives the confirm-page display (from/to/amount). For the
  // address-balance txs we still send our custom encodedTx, but attach this so
  // the detail view renders a clean transfer instead of relying on dryRun.
  const makeTransfersInfo = useCallback((): ITransferInfo[] => {
    const isNative = coinType === SUI_NATIVE_COIN_TYPE;
    return [
      {
        from: ownAddress,
        to,
        amount,
        tokenInfo: {
          address: isNative ? '' : coinType,
          decimals: 9,
          name: 'Sui',
          symbol: 'SUI',
          isNative,
          accountId,
          networkId,
        },
      },
    ];
  }, [coinType, ownAddress, to, amount, accountId, networkId]);

  // 1) Normal transfer — reuses the standard transfersInfo build path.
  const onNormalTransfer = useCallback(async () => {
    if (!guard()) return;
    await navigationToTxConfirm({ transfersInfo: makeTransfersInfo() });
  }, [guard, makeTransfersInfo, navigationToTxConfirm]);

  // 2) Deposit into the recipient's address balance via 0x2::coin::send_funds.
  const onSendToAddressBalance = useCallback(async () => {
    if (!guard()) return;
    const encodedTx =
      await backgroundApiProxy.serviceDemo.demoSuiBuildSendToAddressBalanceEncodedTx(
        { networkId, accountId, recipient: to, amount, coinType },
      );
    await navigationToTxConfirm({
      encodedTx,
      transfersInfo: makeTransfersInfo(),
    });
  }, [
    guard,
    networkId,
    accountId,
    to,
    amount,
    coinType,
    makeTransfersInfo,
    navigationToTxConfirm,
  ]);

  // 3) Withdraw from own address balance and send it out (withdrawal + redeem_funds).
  const onWithdrawFromAddressBalance = useCallback(async () => {
    if (!guard()) return;
    const encodedTx =
      await backgroundApiProxy.serviceDemo.demoSuiBuildWithdrawFromAddressBalanceEncodedTx(
        { networkId, accountId, recipient: to, amount, coinType },
      );
    await navigationToTxConfirm({
      encodedTx,
      transfersInfo: makeTransfersInfo(),
    });
  }, [
    guard,
    networkId,
    accountId,
    to,
    amount,
    coinType,
    makeTransfersInfo,
    navigationToTxConfirm,
  ]);

  // 4) Estimate the gas budget purely via RPC (dryRun), no server endpoint.
  const onEstimateFeeByRpc = useCallback(async () => {
    if (!guard()) return;
    const feeBudget =
      await backgroundApiProxy.serviceDemo.demoSuiEstimateFeeByRpc({
        networkId,
        accountId,
        recipient: to,
        amount,
        coinType,
      });
    console.log('demoSuiEstimateFeeByRpc:', feeBudget);
    Toast.success({
      title: `budget=${feeBudget?.budget ?? '-'} gasPrice=${
        feeBudget?.gasPrice ?? '-'
      }`,
    });
  }, [guard, networkId, accountId, to, amount, coinType]);

  return (
    <YStack gap="$4">
      <SizableText size="$bodySm" color="$textSubdued">
        network: {networkId || '-'}
        {'\n'}account: {ownAddress || '-'}
      </SizableText>
      {!isSui ? (
        <SizableText color="$textCritical">
          Current account is not Sui. Switch the home account selector to a Sui
          account first.
        </SizableText>
      ) : null}

      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          Recipient (default: self)
        </SizableText>
        <Input
          value={recipient}
          onChangeText={setRecipient}
          placeholder={ownAddress}
        />

        <SizableText size="$bodyMdMedium">Amount (SUI)</SizableText>
        <Input value={amount} onChangeText={setAmount} keyboardType="numeric" />

        <SizableText size="$bodyMdMedium">Coin type</SizableText>
        <Input value={coinType} onChangeText={setCoinType} />
      </YStack>

      <YStack gap="$3">
        <Button variant="primary" onPress={onNormalTransfer}>
          普通转账 (normal transfer)
        </Button>
        <Button onPress={onSendToAddressBalance}>
          转入余额账户 (coin::send_funds)
        </Button>
        <Button onPress={onWithdrawFromAddressBalance}>
          从余额账户转出 (withdrawal + redeem_funds)
        </Button>
        <Button onPress={onEstimateFeeByRpc}>
          RPC 预估手续费 (dryRun, no server)
        </Button>
      </YStack>
    </YStack>
  );
}

const SuiDemoGallery = () => (
  <Stack flex={1} padding="$5">
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <SuiDemo />
    </AccountSelectorProviderMirror>
  </Stack>
);

export default SuiDemoGallery;
