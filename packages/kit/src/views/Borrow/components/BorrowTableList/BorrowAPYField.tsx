import type { IBorrowApy } from '@onekeyhq/shared/types/staking';

import { ApyTextV2 } from './ApyTextV2';
import { FieldWrapper } from './FieldWrapper';

type IBorrowAPYFieldProps = {
  apyDetail: IBorrowApy;
};

export const BorrowAPYField = ({ apyDetail }: IBorrowAPYFieldProps) => {
  return (
    <FieldWrapper ai="flex-end">
      <ApyTextV2 apyDetail={apyDetail} />
    </FieldWrapper>
  );
};
