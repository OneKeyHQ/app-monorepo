import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { NumberSizeableText } from '@onekeyhq/components';
import {
  useSwapApproveAllowanceSelectOpenAtom,
  useSwapQuoteApproveAllowanceUnLimitAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IAllowanceResult,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapApproveAllowanceType } from '@onekeyhq/shared/types/swap/types';

import SwapApproveAllowanceSelect from '../../components/SwapApproveAllowanceSelect';
import { getSwapDisplayAmount } from '../../utils/swapAmountUtils';

interface ISwapApproveAllowanceSelectProps {
  allowanceResult: IAllowanceResult;
  fromToken: Pick<ISwapTokenBase, 'symbol' | 'balanceMultiplier'>;
  isLoading?: boolean;
}

const SwapApproveAllowanceSelectContainer = ({
  allowanceResult,
  fromToken,
  isLoading,
}: ISwapApproveAllowanceSelectProps) => {
  const intl = useIntl();
  const [
    swapQuoteApproveAllowanceUnLimit,
    setSwapQuoteApproveAllowanceUnLimit,
  ] = useSwapQuoteApproveAllowanceUnLimitAtom();
  const [, setSwapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const { symbol, balanceMultiplier } = fromToken;
  const displayAmount = getSwapDisplayAmount(
    allowanceResult.amount,
    balanceMultiplier,
  );
  const approveAllowanceSelectItems = useMemo(
    () => [
      {
        label: (
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="balance"
            formatterOptions={{ tokenSymbol: symbol }}
          >
            {displayAmount ?? '--'}
          </NumberSizeableText>
        ) as unknown as string,
        value: ESwapApproveAllowanceType.PRECISION,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.swap_page_provider_approve_amount_un_limit,
        }),
        value: ESwapApproveAllowanceType.UN_LIMIT,
      },
    ],
    [displayAmount, symbol, intl],
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
      currentSelectAllowanceValue={
        approveAllowanceSelectItems[swapQuoteApproveAllowanceUnLimit ? 1 : 0]
      }
      onSelectAllowanceValue={onSelectAllowanceValue}
      selectItems={approveAllowanceSelectItems}
      isLoading={isLoading}
      onSelectOpenChange={setSwapApproveAllowanceSelectOpen}
    />
  );
};

export default memo(SwapApproveAllowanceSelectContainer);
