import type { IBorrowApy } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';

import { FieldWrapper } from './FieldWrapper';

type IBorrowAPYFieldProps = {
  apyDetail: IBorrowApy;
};

export const BorrowAPYField = ({ apyDetail }: IBorrowAPYFieldProps) => {
  return (
    <FieldWrapper ai="flex-end">
      <EarnText text={apyDetail.title} size="$bodyMdMedium" color="$text" />
    </FieldWrapper>
  );
};
