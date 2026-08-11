import { useEffect, useMemo, useState } from 'react';

import { type RouteProp, useRoute } from '@react-navigation/core';
import {
  address as BitcoinJsAddress,
  networks as BitcoinJsNetworks,
  Psbt,
  Transaction,
  payments,
} from 'bitcoinjs-lib';

// cspell:ignore babylonlabs

import {
  Dialog,
  Icon,
  Page,
  Progress,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  IBatchPsbtWalletType,
  IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

// Core functions are loaded dynamically to avoid a kit -> core value import.
async function loadCoreBtcSdk() {
  return import('@onekeyhq/core/src/chains/btc/sdkBtc');
}

type IMockTransaction = {
  id: number;
  amount: string;
  fiatAmount: string;
  recipient: string;
  fee: string;
  inputs: number;
  outputs: number;
};

type TBatchSigningStage = 'overview' | 'signing' | 'complete';

const MOCK_TRANSACTIONS: IMockTransaction[] = [
  {
    id: 1,
    amount: '0.021 BTC',
    fiatAmount: '$2,432.84',
    recipient: 'bc1p8m…6q4x',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 2,
    amount: '0.018 BTC',
    fiatAmount: '$2,085.29',
    recipient: 'bc1p0s…c83n',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 3,
    amount: '0.026 BTC',
    fiatAmount: '$3,012.08',
    recipient: 'bc1p3d…9p2k',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 4,
    amount: '0.015 BTC',
    fiatAmount: '$1,737.74',
    recipient: 'bc1ph7…qf8w',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 5,
    amount: '0.019 BTC',
    fiatAmount: '$2,201.14',
    recipient: 'bc1p5k…v4zr',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 6,
    amount: '0.017 BTC',
    fiatAmount: '$1,969.86',
    recipient: 'bc1p2n…8t6m',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 7,
    amount: '0.024 BTC',
    fiatAmount: '$2,781.58',
    recipient: 'bc1px4…cw5j',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 8,
    amount: '0.016 BTC',
    fiatAmount: '$1,853.59',
    recipient: 'bc1p9v…3h7s',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 9,
    amount: '0.022 BTC',
    fiatAmount: '$2,548.58',
    recipient: 'bc1pj6…a2ne',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 10,
    amount: '0.020 BTC',
    fiatAmount: '$2,316.89',
    recipient: 'bc1pr1…7z9d',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 11,
    amount: '0.014 BTC',
    fiatAmount: '$1,621.82',
    recipient: 'bc1pf8…2u6c',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 12,
    amount: '0.023 BTC',
    fiatAmount: '$2,664.97',
    recipient: 'bc1pm3…5w1q',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 13,
    amount: '0.012 BTC',
    fiatAmount: '$1,390.79',
    recipient: 'bc1pt7…4b9x',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 14,
    amount: '0.025 BTC',
    fiatAmount: '$2,896.99',
    recipient: 'bc1pc5…8r2v',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
  {
    id: 15,
    amount: '0.012 BTC',
    fiatAmount: '$1,390.79',
    recipient: 'bc1pn9…6k3f',
    fee: '0.000012 BTC',
    inputs: 1,
    outputs: 2,
  },
];

function getMockBitcoinNetwork(accountAddress: string) {
  if (
    accountAddress.startsWith('bc1') ||
    accountAddress.startsWith('1') ||
    accountAddress.startsWith('3')
  ) {
    return BitcoinJsNetworks.bitcoin;
  }

  return BitcoinJsNetworks.testnet;
}

function getAccountFullPath({
  accountPath,
  accountRelPath,
}: {
  accountPath: string;
  accountRelPath?: string;
}) {
  const relPath = accountRelPath || '0/0';
  return accountPath.endsWith(relPath)
    ? accountPath
    : `${accountPath}/${relPath}`;
}

function buildAccountMatchedMockPsbt({
  transaction,
  accountAddress,
  accountPublicKey,
}: {
  transaction: IMockTransaction;
  accountAddress: string;
  accountPublicKey: string;
}) {
  const network = getMockBitcoinNetwork(accountAddress);
  const publicKey = Buffer.from(accountPublicKey, 'hex');
  const accountOutputScript = BitcoinJsAddress.toOutputScript(
    accountAddress,
    network,
  );
  const amountValue = Math.round(
    Number(transaction.amount.replace(' BTC', '')) * 100_000_000,
  );
  const feeValue = Math.round(
    Number(transaction.fee.replace(' BTC', '')) * 100_000_000,
  );
  const changeValue = 100_000;
  const inputValue = amountValue + feeValue + changeValue;
  const psbt = new Psbt({ network });
  const inputHash = transaction.id.toString(16).padStart(64, '0');
  const input = {
    hash: inputHash,
    index: 0,
    sequence: 0xff_ff_ff_fd,
  };

  if (accountAddress.startsWith('1')) {
    const fundingTransaction = new Transaction();
    fundingTransaction.version = 2;
    fundingTransaction.addInput(
      Buffer.alloc(32, transaction.id),
      0xff_ff_ff_ff,
    );
    fundingTransaction.addOutput(accountOutputScript, BigInt(inputValue));
    psbt.addInput({
      ...input,
      hash: fundingTransaction.getId(),
      nonWitnessUtxo: fundingTransaction.toBuffer(),
    });
  } else if (accountAddress.startsWith('3') || accountAddress.startsWith('2')) {
    const redeemPayment = payments.p2wpkh({ pubkey: publicKey, network });
    const nestedSegwitPayment = payments.p2sh({
      redeem: redeemPayment,
      network,
    });
    if (
      !redeemPayment.output ||
      nestedSegwitPayment.address !== accountAddress
    ) {
      throw new OneKeyLocalError('Unable to create the mock redeem script');
    }

    psbt.addInput({
      ...input,
      witnessUtxo: {
        script: accountOutputScript,
        value: BigInt(inputValue),
      },
      redeemScript: redeemPayment.output,
    });
  } else if (
    accountAddress.startsWith('bc1p') ||
    accountAddress.startsWith('tb1p') ||
    accountAddress.startsWith('bcrt1p')
  ) {
    psbt.addInput({
      ...input,
      witnessUtxo: {
        script: accountOutputScript,
        value: BigInt(inputValue),
      },
      tapInternalKey: publicKey.subarray(1, 33),
    });
  } else {
    psbt.addInput({
      ...input,
      witnessUtxo: {
        script: accountOutputScript,
        value: BigInt(inputValue),
      },
    });
  }

  const recipientHash = Buffer.alloc(20, transaction.id);
  const recipientScript = Buffer.concat([
    Buffer.from([0x00, 0x14]),
    recipientHash,
  ]);
  const recipientAddress = BitcoinJsAddress.fromOutputScript(
    recipientScript,
    network,
  );

  psbt.addOutput({
    script: recipientScript,
    value: BigInt(amountValue),
  });
  psbt.addOutput({
    address: accountAddress,
    value: BigInt(changeValue),
  });

  return {
    amountValue,
    changeValue,
    feeValue,
    inputHash: psbt.txInputs[0].hash,
    inputValue,
    psbtHex: psbt.toHex(),
    recipientAddress,
  };
}

function buildMockUnsignedTx({
  transaction,
  accountId,
  networkId,
  accountAddress,
  accountPublicKey,
  accountFullPath,
}: {
  transaction: IMockTransaction;
  accountId: string;
  networkId: string;
  accountAddress: string;
  accountPublicKey: string;
  accountFullPath: string;
}): IUnsignedTxPro {
  const {
    amountValue,
    changeValue,
    feeValue,
    inputHash,
    inputValue,
    psbtHex,
    recipientAddress,
  } = buildAccountMatchedMockPsbt({
    transaction,
    accountAddress,
    accountPublicKey,
  });
  const inputHashBuffer = Buffer.from(inputHash);
  inputHashBuffer.reverse();
  const inputTxid = inputHashBuffer.toString('hex');

  const encodedTx: IEncodedTxBtc = {
    inputs: [
      {
        txid: inputTxid,
        vout: 0,
        value: String(inputValue),
        address: accountAddress,
        path: accountFullPath,
      },
    ],
    outputs: [
      {
        address: recipientAddress,
        value: String(amountValue),
        payload: { isChange: false },
      },
      {
        address: accountAddress,
        value: String(changeValue),
        payload: { isChange: true },
      },
    ],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: String(feeValue),
    psbtHex,
    inputsToSign: [
      {
        index: 0,
        publicKey: accountPublicKey,
        address: accountAddress,
        useTweakedSigner:
          accountAddress.startsWith('bc1p') ||
          accountAddress.startsWith('tb1p') ||
          accountAddress.startsWith('bcrt1p'),
      },
    ],
    disabledCoinSelect: true,
    txSize: 180,
  };

  return {
    uuid: `batch-psbt-preview-${transaction.id}`,
    accountId,
    networkId,
    encodedTx,
  };
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack px="$4" py="$3" alignItems="center" gap="$4">
      <SizableText flex={1} size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" textAlign="right">
        {value}
      </SizableText>
    </XStack>
  );
}

function TransactionRow({
  transaction,
  signed,
  onPress,
}: {
  transaction: IMockTransaction;
  signed: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      minHeight="$16"
      px="$3.5"
      py="$3"
      alignItems="center"
      gap="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      bg={signed ? '$bgSuccessSubdued' : '$bgSubdued'}
      userSelect="none"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      focusable
      onPress={onPress}
    >
      <Stack
        width="$9"
        height="$9"
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
        borderRadius="$full"
        bg={signed ? '$bgSuccessSubdued' : '$bgStrong'}
      >
        {signed ? (
          <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />
        ) : (
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {String(transaction.id).padStart(2, '0')}
          </SizableText>
        )}
      </Stack>

      <YStack flex={1} minWidth={0}>
        <XStack alignItems="center" gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {`Transaction ${transaction.id}`}
          </SizableText>
          {signed ? (
            <SizableText size="$bodySmMedium" color="$textSuccess">
              Signed
            </SizableText>
          ) : null}
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {`To ${transaction.recipient}`}
        </SizableText>
      </YStack>

      <YStack flexShrink={0} alignItems="flex-end">
        <SizableText size="$bodyMdMedium">
          {`−${transaction.amount}`}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {transaction.fiatAmount}
        </SizableText>
      </YStack>

      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

function BatchSigningProgress({
  signedCount,
  currentTransaction,
}: {
  signedCount: number;
  currentTransaction?: IMockTransaction;
}) {
  const totalCount = MOCK_TRANSACTIONS.length;
  const remainingCount = totalCount - signedCount;
  const isComplete = remainingCount === 0;
  const progressValue = (signedCount / totalCount) * 100;
  let progressDescription =
    'Review and approve this transaction on your hardware wallet';
  if (isComplete) {
    progressDescription = `${totalCount} signatures are ready to return to the DApp`;
  }

  return (
    <YStack
      width="100%"
      maxWidth={480}
      alignSelf="center"
      justifyContent="center"
      gap="$5"
      py="$8"
    >
      <YStack alignItems="center" gap="$2">
        <Stack
          width="$12"
          height="$12"
          alignItems="center"
          justifyContent="center"
          borderRadius="$full"
          bg={isComplete ? '$bgSuccessSubdued' : '$bgStrong'}
        >
          <Icon
            name={isComplete ? 'CheckRadioSolid' : 'BitcoinOutline'}
            size="$6"
            color={isComplete ? '$iconSuccess' : '$icon'}
          />
        </Stack>
        <SizableText size="$headingLg" textAlign="center">
          {isComplete
            ? 'All transactions signed'
            : `Signing transaction ${Math.min(
                signedCount + 1,
                totalCount,
              )} of ${totalCount}`}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {progressDescription}
        </SizableText>
      </YStack>

      <YStack gap="$2">
        <Progress animated size="medium" value={progressValue} />
        <XStack alignItems="center">
          <SizableText flex={1} size="$bodySm" color="$textSubdued">
            {`${signedCount} signed`}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {`${remainingCount} remaining`}
          </SizableText>
        </XStack>
      </YStack>

      {!isComplete && currentTransaction ? (
        <YStack
          px="$4"
          py="$3.5"
          gap="$2"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$3"
          bg="$bgSubdued"
        >
          <SizableText size="$bodySmMedium" color="$textSubdued">
            Current transaction
          </SizableText>
          <XStack alignItems="center" gap="$4">
            <YStack flex={1} minWidth={0}>
              <SizableText size="$bodyMdMedium">
                {`Transaction ${currentTransaction.id}`}
              </SizableText>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {`To ${currentTransaction.recipient}`}
              </SizableText>
            </YStack>
            <SizableText size="$bodyMdMedium">
              {`−${currentTransaction.amount}`}
            </SizableText>
          </XStack>
        </YStack>
      ) : null}

      {!isComplete ? (
        <XStack
          px="$4"
          py="$3"
          alignItems="center"
          gap="$3"
          borderRadius="$3"
          bg="$bgSubdued"
        >
          <Icon name="LaptopOutline" size="$5" color="$iconSubdued" />
          <SizableText flex={1} size="$bodySm" color="$textSubdued">
            Keep your device connected. You will confirm every transaction
            separately.
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}

function BatchPsbtSigningModalContent() {
  const route =
    useRoute<
      RouteProp<
        IModalSignatureConfirmParamList,
        EModalSignatureConfirmRoutes.BatchPsbtConfirm
      >
    >();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const walletType = route.params?.walletType ?? 'hardware';
  const [signedTransactionIds, setSignedTransactionIds] = useState<number[]>(
    [],
  );
  const [signingStage, setSigningStage] =
    useState<TBatchSigningStage>('overview');
  const [batchTransactionIds, setBatchTransactionIds] = useState<number[]>([]);
  const [batchProgressIndex, setBatchProgressIndex] = useState(0);

  const remainingTransactions = useMemo(
    () =>
      MOCK_TRANSACTIONS.filter(
        (transaction) => !signedTransactionIds.includes(transaction.id),
      ),
    [signedTransactionIds],
  );
  const allSigned = signedTransactionIds.length === MOCK_TRANSACTIONS.length;
  const currentBatchTransaction = useMemo(() => {
    const transactionId = batchTransactionIds[batchProgressIndex];
    return MOCK_TRANSACTIONS.find(
      (transaction) => transaction.id === transactionId,
    );
  }, [batchProgressIndex, batchTransactionIds]);

  useEffect(() => {
    if (signingStage !== 'signing' || !currentBatchTransaction) {
      return undefined;
    }

    const timer = setTimeout(
      () => {
        setSignedTransactionIds((currentIds) => [
          ...new Set([...currentIds, currentBatchTransaction.id]),
        ]);

        const nextProgressIndex = batchProgressIndex + 1;
        if (nextProgressIndex >= batchTransactionIds.length) {
          setSigningStage('complete');
        } else {
          setBatchProgressIndex(nextProgressIndex);
        }
      },
      walletType === 'hardware' ? 1800 : 450,
    );

    return () => clearTimeout(timer);
  }, [
    batchProgressIndex,
    batchTransactionIds.length,
    currentBatchTransaction,
    signingStage,
    walletType,
  ]);

  const openExistingTransactionConfirm = async (
    transaction: IMockTransaction,
  ) => {
    const account = activeAccount.account;
    const accountId = account?.id;
    const networkId = activeAccount.network?.id;
    const networkCode = activeAccount.network?.code;
    const accountAddress = account?.address;

    if (
      !account ||
      !accountId ||
      !networkId ||
      !networkCode ||
      !accountAddress
    ) {
      Toast.error({
        title: 'Select a Bitcoin account before opening transaction details',
      });
      return;
    }

    let unsignedTx: IUnsignedTxPro;
    try {
      const receiveAddressPath = account.addressDetail.receiveAddressPath;
      const accountRelPath =
        receiveAddressPath?.split('/').slice(-2).join('/') ||
        account.relPath ||
        '0/0';
      const accountFullPath =
        receiveAddressPath ||
        getAccountFullPath({
          accountPath: account.path,
          accountRelPath,
        });
      const accountXpub = 'xpub' in account ? account.xpub : undefined;
      let accountPublicKey = account.pub;

      if (accountXpub) {
        const { getBtcForkNetwork, getPublicKeyFromXpub } =
          await loadCoreBtcSdk();
        accountPublicKey = getPublicKeyFromXpub({
          xpub: accountXpub,
          network: getBtcForkNetwork(networkCode),
          relPath: accountRelPath,
        });
      }
      if (!accountPublicKey) {
        throw new OneKeyLocalError(
          'Unable to resolve the active Bitcoin public key',
        );
      }

      unsignedTx = buildMockUnsignedTx({
        transaction,
        accountId,
        networkId,
        accountAddress,
        accountPublicKey,
        accountFullPath,
      });
    } catch (_error) {
      Toast.error({
        title: 'Unable to build the account-matched mock PSBT',
      });
      return;
    }

    navigation.push(EModalSignatureConfirmRoutes.TxConfirm, {
      accountId,
      networkId,
      unsignedTxs: [unsignedTx],
      signOnly: true,
      feeInfoEditable: false,
      popStack: false,
      onSuccess: () => {
        setSignedTransactionIds((currentIds) => [
          ...new Set([...currentIds, transaction.id]),
        ]);
        Toast.success({ title: `Transaction ${transaction.id} signed` });
      },
    });
  };

  const startBatchSigning = () => {
    setBatchTransactionIds(
      remainingTransactions.map((transaction) => transaction.id),
    );
    setBatchProgressIndex(0);
    setSigningStage('signing');
  };

  const showBatchSigningNotice = () => {
    const transactionCount = remainingTransactions.length;
    Dialog.show({
      icon: walletType === 'hardware' ? 'LaptopOutline' : 'WalletOutline',
      title:
        transactionCount === MOCK_TRANSACTIONS.length
          ? `Sign all ${transactionCount} transactions?`
          : `Sign ${transactionCount} remaining transactions?`,
      description:
        walletType === 'hardware'
          ? 'You’ll review and approve each transaction on your hardware wallet. Keep the device connected until signing is complete.'
          : `Authorize once to sign all ${transactionCount} transactions. Review the transaction summary carefully before continuing, as signing will begin immediately after you confirm.`,
      renderContent: (
        <XStack
          px="$4"
          py="$3"
          alignItems="center"
          borderRadius="$3"
          bg="$bgSubdued"
        >
          <SizableText flex={1} size="$bodyMd" color="$textSubdued">
            Transactions
          </SizableText>
          <SizableText size="$bodyMdMedium">{transactionCount}</SizableText>
        </XStack>
      ),
      onCancelText: 'Cancel',
      onConfirmText: walletType === 'hardware' ? 'Continue' : 'Sign all',
      onConfirm: () => {
        if (walletType === 'hardware') {
          startBatchSigning();
          return;
        }
        setSignedTransactionIds(MOCK_TRANSACTIONS.map(({ id }) => id));
        Toast.success({
          title: `${MOCK_TRANSACTIONS.length} transactions signed`,
        });
      },
    });
  };

  let confirmText = `Sign all ${MOCK_TRANSACTIONS.length}`;
  if (allSigned) {
    confirmText = 'Done';
  } else if (signedTransactionIds.length) {
    confirmText = `Sign remaining ${remainingTransactions.length}`;
  }

  if (signingStage !== 'overview') {
    return (
      <Page>
        <Page.Header title="Batch PSBT Signing" />
        <Page.Body px="$5">
          <BatchSigningProgress
            signedCount={signedTransactionIds.length}
            currentTransaction={currentBatchTransaction}
          />
        </Page.Body>
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={
              signingStage === 'complete' ? 'Done' : 'Waiting for signature…'
            }
            confirmButtonProps={{
              disabled: signingStage !== 'complete',
            }}
            onConfirm={(_close, closePageStack) => {
              if (signingStage === 'complete') {
                closePageStack();
              }
            }}
          />
        </Page.Footer>
      </Page>
    );
  }

  return (
    <Page scrollEnabled>
      <Page.Header title="Batch PSBT Signing" />
      <Page.Body px="$5">
        <YStack width="100%" maxWidth={640} alignSelf="center" gap="$4" pb="$6">
          <YStack gap="$2">
            <YStack bg="$bgSubdued" borderRadius="$3" overflow="hidden">
              <SummaryRow
                label="Transactions"
                value={`${MOCK_TRANSACTIONS.length}`}
              />
              <Stack height={1} bg="$borderSubdued" />
              <SummaryRow label="Total outgoing" value="0.284 BTC" />
              <Stack height={1} bg="$borderSubdued" />
              <SummaryRow label="Total network fee" value="0.000180 BTC" />
            </YStack>
          </YStack>

          <YStack gap="$2.5">
            <XStack alignItems="center">
              <SizableText flex={1} size="$bodyMdMedium" color="$textSubdued">
                Transactions
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {`${remainingTransactions.length} remaining`}
              </SizableText>
            </XStack>

            {MOCK_TRANSACTIONS.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                signed={signedTransactionIds.includes(transaction.id)}
                onPress={() => void openExistingTransactionConfirm(transaction)}
              />
            ))}
          </YStack>
        </YStack>
      </Page.Body>

      <Page.Footer>
        <Page.FooterActions
          onConfirmText={confirmText}
          onConfirm={(_close, closePageStack) => {
            if (allSigned) {
              closePageStack();
              return;
            }
            showBatchSigningNotice();
          }}
          onCancelText={allSigned ? undefined : 'Reject all'}
          cancelButtonProps={allSigned ? undefined : { variant: 'secondary' }}
        />
      </Page.Footer>
    </Page>
  );
}

export const BatchPsbtSigningModal = () => (
  <AccountSelectorProviderMirror
    config={{ sceneName: EAccountSelectorSceneName.home }}
    enabledNum={[0]}
  >
    <BatchPsbtSigningModalContent />
  </AccountSelectorProviderMirror>
);

function WalletFlowOption({
  icon,
  title,
  description,
  onPress,
}: {
  icon: 'WalletOutline' | 'LaptopOutline';
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <XStack
      minHeight="$20"
      px="$4"
      py="$4"
      alignItems="center"
      gap="$3.5"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      bg="$bgSubdued"
      userSelect="none"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      focusable
      onPress={onPress}
    >
      <Stack
        width="$10"
        height="$10"
        alignItems="center"
        justifyContent="center"
        borderRadius="$full"
        bg="$bgStrong"
      >
        <Icon name={icon} size="$5" />
      </Stack>
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText size="$bodyLgMedium">{title}</SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {description}
        </SizableText>
      </YStack>
      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

function BatchPsbtSigningGallery() {
  const navigation = useAppNavigation();
  const openModal = (walletType: IBatchPsbtWalletType) => {
    navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
      screen: EModalSignatureConfirmRoutes.BatchPsbtConfirm,
      params: { walletType },
    });
  };
  const openSoftwareWallet = () => openModal('software');
  const openHardwareWallet = () => openModal('hardware');

  return (
    <Page>
      <Page.Header title="Batch PSBT Signing" />
      <Page.Body px="$5">
        <YStack width="100%" maxWidth={640} alignSelf="center" gap="$4" py="$5">
          <YStack gap="$1">
            <SizableText size="$headingLg">Choose a wallet type</SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              Preview each batch signing flow separately.
            </SizableText>
          </YStack>

          <YStack gap="$3">
            <WalletFlowOption
              icon="WalletOutline"
              title="Software wallet"
              description="Authorize once, then sign the batch automatically"
              onPress={openSoftwareWallet}
            />
            <WalletFlowOption
              icon="LaptopOutline"
              title="Hardware wallet"
              description="Review and approve every transaction on your device"
              onPress={openHardwareWallet}
            />
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default BatchPsbtSigningGallery;
