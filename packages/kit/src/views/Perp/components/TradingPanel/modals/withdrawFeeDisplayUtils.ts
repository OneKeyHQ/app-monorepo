import { BigNumber } from 'bignumber.js';

import {
  type IUsdcWithdrawFeeQuote,
  USDC_WITHDRAW_GAS_RESERVE,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

export function formatUsdcWithdrawFeeText({
  feeQuote,
  reserve,
  includeReserve,
  isReserveEstimate = false,
}: {
  feeQuote: IUsdcWithdrawFeeQuote | undefined;
  reserve: string | undefined;
  includeReserve: boolean;
  isReserveEstimate?: boolean;
}) {
  if (!feeQuote || (includeReserve && !reserve)) return undefined;

  const components = feeQuote.components.filter(
    (component) => !includeReserve || component.kind !== 'hyperEvmGas',
  );
  let total = components.reduce(
    (sum, component) => sum.plus(component.amount),
    new BigNumber(0),
  );
  let isLessThan = components.some(
    (component) => component.kind === 'hyperEvmGas',
  );
  const isEstimate =
    (includeReserve && isReserveEstimate) ||
    components.some(
      (component) => component.kind !== 'hyperEvmGas' && component.isEstimate,
    );

  if (includeReserve && reserve) {
    total = total.plus(reserve);
    isLessThan ||= new BigNumber(reserve).lte(USDC_WITHDRAW_GAS_RESERVE);
  }
  let prefix = '';
  if (isEstimate) {
    prefix = '≈ ';
  } else if (isLessThan) {
    prefix = '< ';
  }
  return `${prefix}$${total.toFixed(2)}`;
}
