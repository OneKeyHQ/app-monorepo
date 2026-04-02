import BigNumber from 'bignumber.js';

import type { IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';

import { FieldWrapper } from './FieldWrapper';

type IAmountFieldProps = {
  title: IEarnText;
  description: IEarnText;
};

export const AmountField = ({ title, description }: IAmountFieldProps) => {
  const isZero = new BigNumber(title.text || 0).isZero();

  return (
    <FieldWrapper ai="flex-end">
      <EarnText text={title} size="$bodyMdMedium" color="$text" />
      {!isZero ? (
        <EarnText text={description} size="$bodySm" color="$textSubdued" />
      ) : null}
    </FieldWrapper>
  );
};
