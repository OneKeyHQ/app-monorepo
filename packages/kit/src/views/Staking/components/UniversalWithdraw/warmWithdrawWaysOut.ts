import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  buildEmptyAmountFirstFrameKey,
  buildWaysOutFirstFrameKey,
  keepFirstFrame,
  warmFirstFrame,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnFirstFrameCache';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';
import type { IStakeTransactionConfirmation } from '@onekeyhq/shared/types/staking';

/**
 * A position's answer for an empty withdrawal (its ways out, its rows), read
 * ahead while the pointer is on its Redeem, so the withdraw form opens with
 * them in place rather than growing for the Instant and Queued cards a moment
 * after it shows
 */
export function warmWithdrawWaysOut({
  accountId,
  networkId,
  providerName,
  symbol,
  vault,
  inputTokenAddress,
}: {
  accountId: string;
  networkId: string;
  providerName: string;
  symbol: string;
  vault?: string;
  // The position's token, as the form sends it
  inputTokenAddress?: string;
}) {
  const shownVault = earnUtils.shouldSendEarnProtocolVault({ providerName })
    ? vault
    : undefined;
  return warmFirstFrame<IStakeTransactionConfirmation>(
    buildEmptyAmountFirstFrameKey({
      action: 'unstake',
      networkId,
      providerName,
      symbol,
      vault: shownVault,
    }),
    async () => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId,
          provider: providerName,
          symbol,
          vault: shownVault || '',
          accountAddress: account.address,
          action: ECheckAmountActionType.UNSTAKING,
          amount: '0',
          inputTokenAddress,
        });
      keepFirstFrame(
        buildWaysOutFirstFrameKey({ networkId, providerName }),
        resp?.withdrawPath?.data?.confirmBoxes ?? [],
      );
      return resp;
    },
  );
}
