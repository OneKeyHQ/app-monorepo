/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import BigNumber from 'bignumber.js';

import { RestfulRequest } from '@onekeyhq/shared/src/request/RestfulRequest';

import type { EIP1559Fee, EIP1559Price } from './geth';

const GWEI_MULTIPLY = new BigNumber(1).shiftedBy(9);

class MmFee {
  readonly restful;

  constructor(readonly chainId: number) {
    this.restful = new RestfulRequest(
      'https://gas-api.metaswap.codefi.network',
    );
  }

  async estimateEIP1559Fee(): Promise<EIP1559Fee> {
    const data: any = await this.restful
      .get(`/networks/${this.chainId}/suggestedGasFees`)
      .then((i) => i.json());

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const baseFee = new BigNumber(data.estimatedBaseFee).multipliedBy(
      GWEI_MULTIPLY,
    );
    const decodePrice = (price: any): EIP1559Price => ({
      maxFeePerGas: new BigNumber(price.suggestedMaxFeePerGas).multipliedBy(
        GWEI_MULTIPLY,
      ),
      maxPriorityFeePerGas: new BigNumber(
        price.suggestedMaxPriorityFeePerGas,
      ).multipliedBy(GWEI_MULTIPLY),
    });

    return {
      baseFee,
      normal: decodePrice(data.medium),
      others: [data.low, data.high]
        .filter((price) => typeof price === 'object')
        .map(decodePrice),
    };
  }
}

export { MmFee };
