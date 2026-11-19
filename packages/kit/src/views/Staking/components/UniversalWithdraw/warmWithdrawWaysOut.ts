import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  buildWaysOutFirstFrameKey,
  keepFirstFrame,
  warmFirstFrame,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnFirstFrameCache';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';
import type { IStakeTransactionConfirmation } from '@onekeyhq/shared/types/staking';

/** Keep only the shape needed for a placeholder, without account data. */
export function keepWithdrawWaysOutShape({
  networkId,
  providerName,
  confirmation,
}: {
  networkId: string;
  providerName: string;
  confirmation?: IStakeTransactionConfirmation;
}) {
  const boxes = confirmation?.withdrawPath?.data?.confirmBoxes;
  if (!boxes?.length) return;
  keepFirstFrame(
    buildWaysOutFirstFrameKey({ networkId, providerName }),
    boxes.map((box) => ({
      title: { text: '' },
      description: { text: '' },
      subtitle: box.subtitle?.text ? { text: ' ' } : undefined,
      subtitleDescription: box.subtitleDescription?.text
        ? { text: ' ' }
        : undefined,
    })),
  );
}

/** Warm a positive, account-scoped quote; an empty input never requests one. */
export async function warmWithdrawWaysOut({
  accountId,
  networkId,
  providerName,
  symbol,
  vault,
  inputTokenAddress,
  amount,
}: {
  accountId: string;
  networkId: string;
  providerName: string;
  symbol: string;
  vault?: string;
  inputTokenAddress?: string;
  amount?: string;
}) {
  const value = new BigNumber(amount ?? '');
  if (
    !accountId ||
    !networkId ||
    !providerName ||
    !value.isFinite() ||
    !value.gt(0)
  )
    return undefined;
  const shownVault = earnUtils.shouldSendEarnProtocolVault({ providerName })
    ? vault
    : undefined;
  const account = await backgroundApiProxy.serviceAccount.getAccount({
    accountId,
    networkId,
  });
  const key = JSON.stringify([
    'withdraw-preview',
    accountId,
    account.address,
    networkId,
    providerName,
    symbol,
    shownVault,
    inputTokenAddress,
    value.toFixed(),
  ]);
  return warmFirstFrame<IStakeTransactionConfirmation>(key, async () => {
    const resp =
      await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
        networkId,
        provider: providerName,
        symbol,
        vault: shownVault || '',
        accountAddress: account.address,
        action: ECheckAmountActionType.UNSTAKING,
        amount: value.toFixed(),
        inputTokenAddress,
      });
    keepWithdrawWaysOutShape({ networkId, providerName, confirmation: resp });
    return resp;
  });
}
