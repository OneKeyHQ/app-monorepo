import { useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Icon, Pressable } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { IDecodedTxExtraAlgo } from '@onekeyhq/engine/src/vaults/impl/algo/types';
import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import { IMPL_ALGO } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useClipboard } from '../../../hooks/useClipboard';
import { useNetwork } from '../../../hooks/useNetwork';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { TxActionElementAddressNormal } from '../elements/TxActionElementAddress';
import { TxActionElementDetailCellTitleText } from '../elements/TxActionElementDetailCell';
import { TxActionElementPressable } from '../elements/TxActionElementPressable';

import { TxDetailActionBox } from './TxDetailActionBox';

import type { ITxActionElementDetail, ITxActionListViewProps } from '../types';

function getFeeInNativeText(options: {
  network?: Network | null;
  decodedTx: IDecodedTx;
}) {
  const {
    decodedTx: { feeInfo, totalFeeInNative },
    network,
  } = options;
  if (!!totalFeeInNative && !!network) {
    return `${totalFeeInNative} ${network.symbol}`;
  }
  if (!feeInfo || !network) {
    return '--';
  }
  const feeRange = calculateTotalFeeRange(feeInfo);
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
  return `${calculatedTotalFeeInNative} ${network.symbol}`;
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
  const { decodedTx, historyTx, feeInput } = props;
  const { network } = useNetwork({ networkId: decodedTx.networkId });
  const details: ITxActionElementDetail[] = [];
  const intl = useIntl();
  const openBlockBrowser = useOpenBlockBrowser(network);
  const { copyText } = useClipboard();
  const clickTimes = useRef(0);

  if (platformEnv.isDev && decodedTx.nonce && decodedTx.nonce >= 0) {
    details.push({
      title: 'Nonce',
      content: `${new BigNumber(decodedTx.nonce).toFixed()}`,
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
      content: openBlockBrowser.hasAvailable ? (
        <TxActionElementPressable
          icon={<Icon name="ArrowTopRightOnSquareMini" size={20} />}
          onPress={() => {
            openBlockBrowser.openTransactionDetails(decodedTx.txid);
          }}
        >
          <TxActionElementAddressNormal
            address={decodedTx.txid}
            isCopy={false}
            isLabelShow={false}
          />
        </TxActionElementPressable>
      ) : (
        <TxActionElementAddressNormal
          address={decodedTx.txid}
          isLabelShow={false}
        />
      ),
    });
  }
  if (
    network?.impl === IMPL_ALGO &&
    decodedTx.extraInfo &&
    (decodedTx.extraInfo as IDecodedTxExtraAlgo).note
  ) {
    details.push({
      title: intl.formatMessage({ id: 'form__algo__note' }),
      content: (decodedTx.extraInfo as IDecodedTxExtraAlgo).note,
    });
  }
  details.push({
    title: intl.formatMessage({ id: 'content__fee' }),
    content:
      feeInput ||
      getFeeInNativeText({
        network,
        decodedTx,
      }),
  });

  return <TxDetailActionBox details={details} />;
}
