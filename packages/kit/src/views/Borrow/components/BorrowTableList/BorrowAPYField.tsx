import { SizableText } from '@onekeyhq/components';
import type { IBorrowApy } from '@onekeyhq/shared/types/staking';

import { ApyTextV2 } from './ApyTextV2';
import { FieldWrapper } from './FieldWrapper';

type IBorrowAPYFieldProps = {
  apyDetail?: IBorrowApy;
};

export const BorrowAPYField = ({ apyDetail }: IBorrowAPYFieldProps) => {
  return (
    <FieldWrapper ai="flex-end">
      {apyDetail ? (
        <ApyTextV2 apyDetail={apyDetail} />
      ) : (
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          -
        </SizableText>
      )}
    </FieldWrapper>
  );
};
