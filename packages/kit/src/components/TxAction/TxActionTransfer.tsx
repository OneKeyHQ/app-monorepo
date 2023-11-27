export function TxActionTransfer(props: ITxActionCardProps) {
  const intl = useIntl();
  const { action, meta, decodedTx, historyTx, network } = props;
  const { accountId, networkId, status } = decodedTx;
  const { amount, symbol, from, to, isOut, displayDecimals } =
    getTxActionTransferInfo(props);
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );

  const subTitle = isOut ? to : from;
  const subTitleFormated =
    subTitle === 'unknown'
      ? intl.formatMessage({ id: 'form__unknown' })
      : shortenAddress(subTitle);

  if (status === IDecodedTxStatus.Offline) return null;

  return (
    <TxListActionBox
      network={network}
      footer={statusBar}
      symbol={symbol}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      content={
        <TxActionElementAmountNormal
          textAlign="right"
          justifyContent="flex-end"
          amount={amount}
          symbol={symbol}
          decimals={displayDecimals}
          direction={action.direction}
        />
      }
      subTitle={subTitleFormated}
      extra={
        <FormatCurrencyTokenOfAccount
          accountId={accountId}
          networkId={networkId}
          token={
            action.nativeTransfer?.tokenInfo ?? action.tokenTransfer?.tokenInfo
          }
          value={amount}
          render={(ele) => (
            <TxListActionBoxExtraText>{ele}</TxListActionBoxExtraText>
          )}
        />
      }
    />
  );
}
