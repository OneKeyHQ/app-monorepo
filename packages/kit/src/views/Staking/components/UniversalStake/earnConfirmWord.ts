import {
  buildConfirmWordFirstFrameKey,
  keepFirstFrame,
  readFirstFrame,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnFirstFrameCache';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

export type IEarnConfirmWordId =
  | ETranslations.earn_deposit
  | ETranslations.global_continue
  | ETranslations.global_buy;

type IConfirmWordTarget = {
  networkId: string;
  providerName: string;
  symbol: string;
  vault?: string;
};

const buildKey = (target: IConfirmWordTarget) =>
  buildConfirmWordFirstFrameKey({
    ...target,
    // The vault named only for protocols that take one, as the forms send it
    vault: earnUtils.shouldSendEarnProtocolVault({
      providerName: target.providerName,
    })
      ? target.vault
      : undefined,
  });

/**
 * The word on an offer's deposit button before an amount, as its form last
 * showed it: whether the deposit approves first ("Deposit") or not
 * ("Continue") is only known once the form has its protocol, so the shell
 * and the form standing in before it show this word rather than one that
 * changes when the form lands
 */
export function readConfirmWordId(
  target: Partial<IConfirmWordTarget>,
): IEarnConfirmWordId | undefined {
  const { networkId, providerName, symbol } = target;
  if (!networkId || !providerName || !symbol) {
    return undefined;
  }
  return readFirstFrame<IEarnConfirmWordId>(
    buildKey({ networkId, providerName, symbol, vault: target.vault }),
    { orOlder: true },
  );
}

export function keepConfirmWordId(
  target: IConfirmWordTarget,
  wordId: IEarnConfirmWordId,
) {
  keepFirstFrame(buildKey(target), wordId);
}
