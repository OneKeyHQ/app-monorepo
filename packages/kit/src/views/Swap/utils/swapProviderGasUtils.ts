import BigNumber from 'bignumber.js';
import { inRange, isEqual, isInteger } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { OneKeyAppError } from '@onekeyhq/shared/src/errors';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IGasEIP1559, IGasLegacy } from '@onekeyhq/shared/types/fee';
import type {
  IFetchQuoteResult,
  ISwapGasInfo,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import { isSwapGasSponsored } from './swapGasUtils';

/** Provider gas is already adjusted by the build service, in gas units. */
export function parseSwapGasLimit(value: unknown): string | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return undefined;
  const gas = Number(value);
  return isInteger(gas) && inRange(gas, 21_000, 1_000_000_001)
    ? String(gas)
    : undefined;
}

export function selectSwapGasLimit(node: string, provider: unknown): string {
  const floor = parseSwapGasLimit(provider);
  const estimate = parseSwapGasLimit(node);
  return floor && estimate
    ? BigNumber.maximum(estimate, floor).toFixed(0)
    : node;
}

type ISwapGasContext = {
  networkId: string;
  accountId: string;
  encodedTx?: IEncodedTx;
  swapInfo?: ISwapTxInfo;
};

export function isSwapBuildForQuote({
  swapInfo,
  quoteResult,
  networkId,
  accountId,
  accountAddress,
}: Pick<ISwapGasContext, 'swapInfo' | 'networkId' | 'accountId'> & {
  quoteResult: IFetchQuoteResult;
  accountAddress: string;
}) {
  const build = swapInfo?.swapBuildResData.result;
  return Boolean(
    swapInfo &&
    build &&
    swapInfo.sender.accountInfo?.accountId === accountId &&
    swapInfo.sender.token.networkId === networkId &&
    equalsIgnoreCase(swapInfo.accountAddress, accountAddress) &&
    Boolean(quoteResult.quoteId) &&
    build.protocol === quoteResult.protocol &&
    build.kind === quoteResult.kind &&
    isEqual(build.quoteResultCtx, quoteResult.quoteResultCtx) &&
    build.info.provider === quoteResult.info.provider &&
    equalTokenNoCaseSensitive({
      token1: build.fromTokenInfo,
      token2: quoteResult.fromTokenInfo,
    }) &&
    equalTokenNoCaseSensitive({
      token1: build.toTokenInfo,
      token2: quoteResult.toTokenInfo,
    }) &&
    new BigNumber(build.fromAmount ?? NaN).eq(quoteResult.fromAmount ?? NaN) &&
    build.quoteId === quoteResult.quoteId,
  );
}

function getSwapProviderGasLimit({
  networkId,
  accountId,
  encodedTx,
  swapInfo,
}: ISwapGasContext) {
  if (
    !networkUtils.isEvmNetwork({ networkId }) ||
    !swapInfo ||
    !encodedTx ||
    typeof encodedTx !== 'object'
  )
    return undefined;
  const tx = encodedTx as IEncodedTxEvm;
  const build = swapInfo.swapBuildResData;
  if (
    swapInfo.sender.accountInfo?.accountId !== accountId ||
    swapInfo.sender.accountInfo?.networkId !== networkId ||
    swapInfo.sender.token.networkId !== networkId ||
    !equalsIgnoreCase(swapInfo.accountAddress, tx.from) ||
    !build.result.info.provider ||
    !equalTokenNoCaseSensitive({
      token1: swapInfo.sender.token,
      token2: build.result.fromTokenInfo,
    }) ||
    !equalTokenNoCaseSensitive({
      token1: swapInfo.receiver.token,
      token2: build.result.toTokenInfo,
    }) ||
    (build.result.fromAmount !== undefined &&
      !new BigNumber(swapInfo.sender.amount).eq(build.result.fromAmount))
  )
    return undefined;
  if (
    tx.chainId !== undefined &&
    !new BigNumber(tx.chainId).eq(networkId.split('--')[1])
  )
    return undefined;
  const expectedTx =
    build.OKXTxObject ?? (typeof build.tx === 'object' ? build.tx : undefined);
  if (
    expectedTx &&
    (!equalsIgnoreCase(tx.to, expectedTx.to) ||
      (tx.data ?? '0x') !== (expectedTx.data ?? '0x') ||
      !new BigNumber(tx.value ?? 0).eq(expectedTx.value ?? 0))
  )
    return undefined;
  if (
    build.thorSwapCallData &&
    (!equalsIgnoreCase(tx.to, build.thorSwapCallData.vault) ||
      !new BigNumber(tx.value ?? 0).eq(build.thorSwapCallData.amount))
  )
    return undefined;
  if (!expectedTx && !build.thorSwapCallData) {
    let transfer: { to: string; amount: string } | undefined;
    if (build.changellyOrder) {
      transfer = {
        to: build.changellyOrder.payinAddress,
        amount: build.changellyOrder.amountExpectedFrom,
      };
    } else if (build.swftOrder) {
      transfer = {
        to: build.swftOrder.platformAddr,
        amount: build.swftOrder.depositCoinAmt,
      };
    }
    if (
      !transfer ||
      !swapInfo.sender.token.isNative ||
      !equalsIgnoreCase(tx.to, transfer.to) ||
      !new BigNumber(tx.value ?? 0).eq(
        new BigNumber(transfer.amount).shiftedBy(
          swapInfo.sender.token.decimals,
        ),
      )
    )
      return undefined;
  }
  return parseSwapGasLimit(build.result.gasLimit);
}

export function applySwapProviderGasLimit<T extends ISwapGasInfo>({
  gasInfo,
  ...context
}: ISwapGasContext & { gasInfo: T }): T {
  const floor = getSwapProviderGasLimit(context);
  if (!floor) return gasInfo;
  const update = <G extends IGasLegacy | IGasEIP1559>(
    gas: G | undefined,
  ): G | undefined => {
    if (!gas) return gas;
    const limit = selectSwapGasLimit(gas.gasLimit, floor);
    return limit === gas.gasLimit
      ? gas
      : { ...gas, gasLimit: limit, gasLimitForDisplay: limit };
  };
  const gas = update(gasInfo.gas);
  const gasEIP1559 = update(gasInfo.gasEIP1559);
  if (gas === gasInfo.gas && gasEIP1559 === gasInfo.gasEIP1559) return gasInfo;
  if (
    isSwapGasSponsored(gasInfo) ||
    gasInfo.gasAccountEligible ||
    gasInfo.gasAccountQuote
  ) {
    // Quotes are bound to the estimated payload. Changed gas must be user-paid.
    if (
      (gas &&
        (!new BigNumber(gas.originalGasPrice ?? gas.gasPrice).isFinite() ||
          new BigNumber(gas.originalGasPrice ?? gas.gasPrice).lte(0))) ||
      (gasEIP1559 &&
        (!new BigNumber(gasEIP1559.maxFeePerGas).isFinite() ||
          new BigNumber(gasEIP1559.maxFeePerGas).lte(0)))
    ) {
      throw new OneKeyAppError(
        'Cannot use a sponsor quote with changed swap gas',
      );
    }
    return {
      ...gasInfo,
      gas: gas
        ? { ...gas, gasPrice: gas.originalGasPrice ?? gas.gasPrice }
        : gas,
      gasEIP1559,
      payer: 'user',
      megafuelEligible: undefined,
      gasAccountEligible: false,
      gasAccountQuote: undefined,
    };
  }
  return { ...gasInfo, gas, gasEIP1559 };
}

export function applySwapProviderGasLimitToEstimate<
  T extends Pick<
    ISwapGasInfo,
    'payer' | 'megafuelEligible' | 'gasAccountEligible' | 'gasAccountQuote'
  > & {
    gas?: IGasLegacy[];
    gasEIP1559?: IGasEIP1559[];
  },
>({ feesInfo, ...context }: ISwapGasContext & { feesInfo: T }): T {
  let adjustedSponsor: ISwapGasInfo | undefined;
  const gas = feesInfo.gas?.map((item) => {
    const adjusted = applySwapProviderGasLimit({
      ...context,
      gasInfo: { ...feesInfo, gas: item, gasEIP1559: undefined },
    });
    if (adjusted.gas !== item) adjustedSponsor = adjusted;
    return adjusted.gas ?? item;
  });
  const gasEIP1559 = feesInfo.gasEIP1559?.map((item) => {
    const adjusted = applySwapProviderGasLimit({
      ...context,
      gasInfo: { ...feesInfo, gas: undefined, gasEIP1559: item },
    });
    if (adjusted.gasEIP1559 !== item) adjustedSponsor = adjusted;
    return adjusted.gasEIP1559 ?? item;
  });
  const userPaid = adjustedSponsor?.payer === 'user';
  const userGas: IGasLegacy[] | undefined = userPaid
    ? gas?.map((item: IGasLegacy) => {
        const gasPrice = item.originalGasPrice ?? item.gasPrice;
        if (
          !new BigNumber(gasPrice).isFinite() ||
          new BigNumber(gasPrice).lte(0)
        ) {
          throw new OneKeyAppError(
            'Cannot restore the user-paid swap gas price',
          );
        }
        return { ...item, gasPrice };
      })
    : gas;
  return {
    ...feesInfo,
    gas: userGas,
    gasEIP1559,
    ...(adjustedSponsor?.payer === 'user'
      ? {
          payer: 'user',
          megafuelEligible: undefined,
          gasAccountEligible: false,
          gasAccountQuote: undefined,
        }
      : undefined),
  };
}
