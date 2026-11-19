import { DeFiPositionHealthFactorRow } from '@onekeyhq/kit/src/components/DeFi/DeFiPositionHealthFactorRow';

import { resolveHealthFactorValueColor } from '../../../Borrow/components/healthFactorValueColor';
import {
  LOAN_HEALTH_TEXT_COLOR,
  getLoanHealthTone,
} from '../EarnLoanRouter/loanRouter.utils';

import type { IEarnPositionMeta } from './mobile/earnPositionModel';

/**
 * A loan's health factor on its card, in the Borrow page's words: the page's
 * own color and status where the position carries its reading, otherwise
 * the figure in the band the server would color it
 */
export function EarnPositionHealthFactorRow({
  meta,
}: {
  meta: IEarnPositionMeta;
}) {
  const { detail } = meta;
  return (
    <DeFiPositionHealthFactorRow
      healthFactor={meta.healthFactor}
      valueText={detail?.value}
      valueColor={
        detail
          ? resolveHealthFactorValueColor(detail)
          : LOAN_HEALTH_TEXT_COLOR[getLoanHealthTone(meta.healthFactor)]
      }
      status={detail?.status}
    />
  );
}
