import { useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, HStack, IconButton, Pressable, Text } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';

import { FormatCurrencyNativeOfAccount } from '../../../components/Format';
import { useClipboard } from '../../../hooks/useClipboard';
import { useNetwork } from '../../../hooks/useNetwork';
import { TxActionElementAddressNormal } from '../elements/TxActionElementAddress';
import { TxActionElementDetailCellTitleText } from '../elements/TxActionElementDetailCell';

import { TxDetailActionBox } from './TxDetailActionBox';
import { TxDetailHashMoreMenu } from './TxDetailHashMoreMenu';
import { TxInteractInfo } from './TxInteractInfo';

import type { ITxActionElementDetail, ITxActionListViewProps } from '../types';

function getFeeInNativeText(options: {
  network?: Network | null;
  decodedTx: IDecodedTx;
}) {
  const {
    decodedTx: { feeInfo, totalFeeInNative, networkId, accountId },
    network,
  } = options;

  if (!!totalFeeInNative && !!network) {
    return `${BigNumber.max(totalFeeInNative, 0).toFixed()} ${network.symbol}`;
  }
  if (!feeInfo || !network) {
    return '--';
  }
  const feeRange = calculateTotalFeeRange(feeInfo, network.feeDecimals);
  const calculatedTotalFeeInNative = calculateTotalFeeNative({
    amount: feeRange.max,
    info: {
      defaultPresetIndex: '0',
      prices: [],

      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
    },
  });

  return (
    <HStack space={1} alignItems="center">
      <Text>{`${calculatedTotalFeeInNative} ${network.symbol}`}</Text>
      <FormatCurrencyNativeOfAccount
        networkId={networkId}
        accountId={accountId}
        value={calculatedTotalFeeInNative}
        render={(ele) => <Text color="text-subdued">({ele})</Text>}
      />
    </HStack>
  );
}

function checkIsValidHistoryTxId({
  txid,
  txidPattern,
}: {
  txid: string | undefined;
  txidPattern: string | undefined;
}) {
  if (!txid) return false;

  if (!txidPattern) return true;

  return new RegExp(txidPattern).test(txid);
}

// TODO rename ExtraInfoBox
export function TxDetailExtraInfoBox(props: ITxActionListViewProps) {
  const { decodedTx, historyTx, feeInput, isBatchSendConfirm, isSendConfirm } =
    props;
  const { network } = useNetwork({ networkId: decodedTx.networkId });
  const details: Array<ITxActionElementDetail | JSX.Element> = [];
  const intl = useIntl();
  const { copyText } = useClipboard();
  const clickTimes = useRef(0);

  const { interactInfo } = decodedTx;

  if (!isSendConfirm && interactInfo) {
    details.push(
      <TxInteractInfo
        origin={interactInfo?.url ?? ''}
        name={interactInfo?.name}
        icon={interactInfo?.icons[0]}
        networkId={decodedTx?.networkId ?? ''}
        borderWidth={0}
        padding={0}
        mb={0}
      />,
    );
  }

  if (feeInput !== null) {
    details.push({
      title: intl.formatMessage({ id: 'content__fee' }),
      content:
        feeInput ||
        getFeeInNativeText({
          network,
          decodedTx,
        }),
    });
  }

  if (
    checkIsValidHistoryTxId({
      txid: decodedTx.txid,
      txidPattern: network?.settings.transactionIdPattern,
    })
  ) {
    details.push({
      title: (
        <Pressable
          cursor="default" // not working
          style={{
            // @ts-ignore
            cursor: 'default',
          }}
          onPress={() => {
            clickTimes.current += 1;
            if (clickTimes.current > 5) {
              clickTimes.current = 0;
              copyText(JSON.stringify(historyTx ?? decodedTx, null, 2));
            }
          }}
        >
          <TxActionElementDetailCellTitleText>
            {intl.formatMessage({ id: 'content__hash' })}
          </TxActionElementDetailCellTitleText>
        </Pressable>
      ),
      content: (
        <TxActionElementAddressNormal address={decodedTx.txid} isCopy={false} />
      ),
      extra: (
        <TxDetailHashMoreMenu decodedTx={decodedTx}>
          <IconButton
            circle
            type="plain"
            iconSize={18}
            name="EllipsisVerticalOutline"
          />
        </TxDetailHashMoreMenu>
      ),
    });
  }

  if (network?.settings.txExtraInfo) {
    network?.settings.txExtraInfo.forEach((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const extraInfo = decodedTx.extraInfo && decodedTx.extraInfo[item.key];
      if (extraInfo) {
        details.push({
          title: intl.formatMessage({ id: item.title }),
          content: (
            <TxActionElementAddressNormal
              address={extraInfo}
              isCopy={item.canCopy}
              isShorten={item.isShorten}
              numberOfLines={item.numberOfLines ?? 2}
            />
          ),
        });
      }
    });
  }

  if (!details.length) return null;
  if (isBatchSendConfirm) return null;

  return (
    <Box>
      {isSendConfirm ? null : (
        <Text
          typography="Subheading"
          textTransform="uppercase"
          mb={3}
          color="text-subdued"
        >
          {intl.formatMessage({ id: 'content__details' })}
        </Text>
      )}
      <TxDetailActionBox details={details.filter(Boolean)} showContentDivider />
    </Box>
  );
}
