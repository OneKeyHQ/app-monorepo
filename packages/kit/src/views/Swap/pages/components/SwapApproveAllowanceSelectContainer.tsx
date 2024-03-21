import { memo, useCallback, useMemo } from 'react';

import { useSwapQuoteApproveAllowanceUnLimitAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { IAllowanceResult } from '@onekeyhq/shared/types/swap/types';
import { ESwapApproveAllowanceType } from '@onekeyhq/shared/types/swap/types';

import SwapApproveAllowanceSelect from '../../components/SwapApproveAllowanceSelect';

interface ISwapApproveAllowanceSelectProps {
  allowanceResult: IAllowanceResult;
  fromTokenSymbol: string;
  isLoading?: boolean;
}

const SwapApproveAllowanceSelectContainer = ({
  allowanceResult,
  fromTokenSymbol,
  isLoading,
}: ISwapApproveAllowanceSelectProps) => {
  const [, setSwapQuoteApproveAllowanceUnLimit] =
    useSwapQuoteApproveAllowanceUnLimitAtom();
  const approveAllowanceSelectItems = useMemo(
    () => [
      {
        label: `${allowanceResult.amount} ${fromTokenSymbol}`,
        value: ESwapApproveAllowanceType.PRECISION,
      },
      {
        label: 'Unlimited',
        value: ESwapApproveAllowanceType.UN_LIMIT,
      },
    ],
    [fromTokenSymbol, allowanceResult],
  );

  const onSelectAllowanceValue = useCallback(
    (value: string) => {
      setSwapQuoteApproveAllowanceUnLimit(
        value === ESwapApproveAllowanceType.UN_LIMIT,
      );
    },
    [setSwapQuoteApproveAllowanceUnLimit],
  );
  return (
    <SwapApproveAllowanceSelect
      onSelectAllowanceValue={onSelectAllowanceValue}
      selectItems={approveAllowanceSelectItems}
      isLoading={isLoading}
    />
  );
};

export default memo(SwapApproveAllowanceSelectContainer);
