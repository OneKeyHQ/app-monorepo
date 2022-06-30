import React from 'react';

import { useIntl } from 'react-intl';

import { useNetwork } from '../../../hooks/useNetwork';
import { TxActionElementAddressNormal } from '../elements/TxActionElementHashText';
import { ITxActionElementDetail, ITxActionListViewProps } from '../types';

import { TxDetailActionBox } from './TxDetailActionBox';

export function TxDetailFeeInfoBox(props: ITxActionListViewProps) {
  const { decodedTx, feeInput } = props;
  const { network } = useNetwork({ networkId: decodedTx.networkId });
  const details: ITxActionElementDetail[] = [];
  const intl = useIntl();
  details.push({
    title: intl.formatMessage({ id: 'network__network' }),
    content: network?.name ?? '',
  });
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
  if (feeInput) {
    details.push({
      title: intl.formatMessage({ id: 'content__fee' }),
      content: feeInput, // TODO feeInput render large margin in App
    });
  }
  return <TxDetailActionBox details={details} />;
}
