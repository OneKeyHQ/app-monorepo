import type { FC } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Container } from '@onekeyhq/components';
import type { ContentItemProps } from '@onekeyhq/components/src/Container/ContentBasisItem';
import type { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import { ethers } from '@onekeyhq/engine/src/vaults/impl/evm/sdk/ethers';
import type { IFeeInfoPayload } from '@onekeyhq/engine/src/vaults/types';

export type TotalFeeProps = {
  tx: EVMDecodedItem;
  feeInfoPayload?: IFeeInfoPayload;
  transferAmount?: string;
} & Omit<ContentItemProps, 'title'>;

const TotalFee: FC<TotalFeeProps> = (props) => {
  const intl = useIntl();

  const { tx, transferAmount, feeInfoPayload } = props;
  const symbol = feeInfoPayload?.info.nativeSymbol ?? tx.symbol;

  let total = '0';

  if (feeInfoPayload?.current.totalNative) {
    const totalFeeInNative =
      tx.totalFeeInNative ?? feeInfoPayload?.current.totalNative;
    total = new BigNumber(totalFeeInNative)
      .plus(transferAmount ?? '0')
      .toFixed();
  } else {
    // TODO move all ethers.utils function call to build encodedTx
    let value = ethers.utils.parseUnits(tx.value, 'wei');
    if (transferAmount) {
      value = ethers.utils.parseEther(transferAmount);
    }
    const fee = ethers.utils.parseEther(
      feeInfoPayload?.current.totalNative ?? tx.gasInfo.maxFeeSpend,
    );
    total = ethers.utils.formatEther(value.add(fee));
  }

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
