import type { IBorrowApy } from '@onekeyhq/shared/types/staking';

import { AprText } from '../../../Earn/components/AprText';

import { FieldWrapper } from './FieldWrapper';

type IBorrowAPYFieldProps = {
  apyDetail: IBorrowApy;
};

export const BorrowAPYField = ({ apyDetail }: IBorrowAPYFieldProps) => {
  return (
    <FieldWrapper ai="flex-end">
      <AprText
        asset={{
          aprWithoutFee: apyDetail.apy,
          aprInfo: apyDetail,
        }}
      />
    </FieldWrapper>
  );
};
