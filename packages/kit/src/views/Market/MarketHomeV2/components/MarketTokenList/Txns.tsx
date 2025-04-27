import { SizableText, Stack } from '@onekeyhq/components';

interface ITxnsProps {
  transactions: number;
  walletInfo?: string;
}

function Txns({ transactions, walletInfo }: TxnsProps) {
  const formattedTransactions = transactions.toLocaleString();

  return (
    <Stack space="$0.5">
      <SizableText size="$bodyMd">{formattedTransactions}</SizableText>
      {walletInfo ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {walletInfo}
        </SizableText>
      ) : null}
    </Stack>
  );
}

export { Txns };
