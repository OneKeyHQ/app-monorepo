import React, { FC } from 'react';

import { ethers } from '@onekeyfe/blockchain-libs';
import { useIntl } from 'react-intl';

import { Container } from '@onekeyhq/components';
import { ContentItemProps } from '@onekeyhq/components/src/ContentBox/ContentBasisItem';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/types/vault';
import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

export type TotalFeeProps = {
  tx: EVMDecodedItem;
  feeInfoPayload: IFeeInfoPayload;
} & Omit<ContentItemProps, 'title'>;

const TotalFee: FC<TotalFeeProps> = (props) => {
  const intl = useIntl();

  const { tx, feeInfoPayload } = props;
  const symbol = feeInfoPayload.info.nativeSymbol ?? tx.symbol;
  const value = ethers.utils.parseUnits(tx.value, 'wei');
  const fee = ethers.utils.parseEther(feeInfoPayload.current.totalNative);
  const total = ethers.utils.formatEther(value.add(fee));

  return (
    <Container.Item
      {...props}
      title={`${intl.formatMessage({
        id: 'content__total',
      })}(${intl.formatMessage({
        id: 'content__amount',
      })} + ${intl.formatMessage({ id: 'content__fee' })})`}
      describe={`${total} ${symbol}`}
    />
  );
};

export default TotalFee;
