import BigNumber from 'bignumber.js';

import type { IBorrowBalance } from '@onekeyhq/shared/types/staking';

import { BorrowBalanceText } from './BorrowBalanceText';
import { FieldWrapper } from './FieldWrapper';

type IAmountFieldProps = {
  balance: IBorrowBalance;
};

export const AmountField = ({ balance }: IAmountFieldProps) => {
  const isZero = new BigNumber(balance.title.text || 0).isZero();

  return (
    <FieldWrapper ai="flex-end">
      <BorrowBalanceText
        kind="balance"
        text={balance.title}
        value={balance.number ?? balance.amount}
        size="$bodyMdMedium"
        color="$text"
      />
      {!isZero && balance.description ? (
        <BorrowBalanceText
          kind="fiat"
          text={balance.description}
          size="$bodySm"
          color="$textSubdued"
        />
      ) : null}
    </FieldWrapper>
  );
};
