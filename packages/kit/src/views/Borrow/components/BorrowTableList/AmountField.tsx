import type { IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';

import { FieldWrapper } from './FieldWrapper';

type IAmountFieldProps = {
  title: IEarnText;
  description: IEarnText;
};

export const AmountField = ({ title, description }: IAmountFieldProps) => {
  return (
    <FieldWrapper ai="flex-end">
      <EarnText text={title} size="$bodyMdMedium" color="$text" />
      <EarnText text={description} size="$bodySm" color="$textSubdued" />
    </FieldWrapper>
  );
};
