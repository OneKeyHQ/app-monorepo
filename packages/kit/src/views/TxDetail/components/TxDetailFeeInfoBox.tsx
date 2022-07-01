import React from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Network } from '@onekeyhq/engine/src/types/network';
import { IFeeInfoUnit } from '@onekeyhq/engine/src/vaults/types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNetwork } from '../../../hooks/useNetwork';
import { TxActionElementAddressNormal } from '../elements/TxActionElementHashText';
import { ITxActionElementDetail, ITxActionListViewProps } from '../types';

import { TxDetailActionBox } from './TxDetailActionBox';

function getFeeInNativeText(options: {
  network?: Network;
  feeInfo?: IFeeInfoUnit;
}) {
  const { feeInfo, network } = options;
  if (!feeInfo || !network) {
    return '--';
  }
  const feeRange = calculateTotalFeeRange(feeInfo);
  const totalFeeInNative = calculateTotalFeeNative({
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
  return `${totalFeeInNative} ${network.symbol}`;
}

// TODO rename ExtraInfoBox
export function TxDetailFeeInfoBox(props: ITxActionListViewProps) {
  const { decodedTx, feeInput } = props;
  const { network } = useNetwork({ networkId: decodedTx.networkId });
  const details: ITxActionElementDetail[] = [];
  const intl = useIntl();
  details.push({
    title: intl.formatMessage({ id: 'network__network' }),
    content: network?.name ?? '',
  });
  if (decodedTx.interactInfo?.url) {
    details.push({
      title: intl.formatMessage({ id: 'content__interact_with' }),
      content: decodedTx.interactInfo?.url ?? '',
    });
  }
  if (platformEnv.isDev && decodedTx.nonce && decodedTx.nonce > 0) {
    details.push({
      title: 'Nonce',
      content: `${new BigNumber(decodedTx.nonce).toFixed()}`,
    });
  }
  if (decodedTx.txid) {
    details.push({
      title: intl.formatMessage({ id: 'content__hash' }),
      content: (
        <TxActionElementAddressNormal
          address={decodedTx.txid}
          isLabelShow={false}
        />
      ),
    });
  }
  details.push({
    title: intl.formatMessage({ id: 'content__fee' }),
    content:
      feeInput ||
      getFeeInNativeText({
        network,
        feeInfo: decodedTx.feeInfo,
      }),
  });
  return <TxDetailActionBox details={details} />;
}
