import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  buildRewardTokensFirstFrameKey,
  keepFirstFrame,
  readFirstFrame,
  warmFirstFrame,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnFirstFrameCache';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

type IRewardTokensTarget = {
  networkId: string;
  providerName: string;
  symbol: string;
  vault?: string;
};

const EARNING_KINDS = new Set(['base', 'reward', 'campaign']);

/**
 * The tokens an offer pays in, as its rates' breakdown names them: the base
 * rate's token, then a campaign's or a protocol reward's (Spark Savings
 * USDC: USDC, then the USDT bonus). A bonus paying nothing now is left out.
 * Empty where the breakdown names none
 */
export function readRewardTokensFromDetail(
  detail?: Pick<IStakeEarnDetail, 'apyDetail'>,
): string[] {
  const button = detail?.apyDetail?.button;
  if (button?.type !== 'popup') {
    return [];
  }
  const tokens: string[] = [];
  (button.data.items ?? []).forEach((item) => {
    if (!item.kind || !EARNING_KINDS.has(item.kind)) {
      return;
    }
    if (item.kind !== 'base' && !(Number(item.rate) > 0)) {
      return;
    }
    const symbol = (item.yieldToken ?? item.token)?.info?.symbol?.trim();
    if (
      symbol &&
      !tokens.some((token) => token.toUpperCase() === symbol.toUpperCase())
    ) {
      tokens.push(symbol);
    }
  });
  return tokens;
}

// The vault named only for protocols that take one, as the forms send it
const readVault = ({ providerName, vault }: IRewardTokensTarget) =>
  earnUtils.shouldSendEarnProtocolVault({ providerName }) ? vault : undefined;

function buildKey(target: IRewardTokensTarget) {
  return buildRewardTokensFirstFrameKey({
    ...target,
    vault: readVault(target),
  });
}

// The last read, for a stand-in drawn before the form (its skeleton)
export function readRewardTokens(target: IRewardTokensTarget) {
  const tokens = readFirstFrame<string[]>(buildKey(target), { orOlder: true });
  return tokens?.length ? tokens : undefined;
}

// The details page has read the offer already
export function keepRewardTokens(
  target: IRewardTokensTarget,
  detail?: Pick<IStakeEarnDetail, 'apyDetail'>,
) {
  if (detail) {
    keepFirstFrame(buildKey(target), readRewardTokensFromDetail(detail));
  }
}

export function warmRewardTokens(target: IRewardTokensTarget) {
  return warmFirstFrame(buildKey(target), async () =>
    readRewardTokensFromDetail(
      await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
        networkId: target.networkId,
        symbol: target.symbol,
        provider: target.providerName,
        vault: readVault(target),
      }),
    ),
  );
}

/**
 * The tokens an offer's rewards come in, so its empty form holds a line for
 * each from the first frame: the last read for the offer at once, then this
 * one. Undefined while unknown, and where the offer's rates name none
 */
export function useEarnRewardTokens({
  enabled = true,
  ...target
}: IRewardTokensTarget & { enabled?: boolean }) {
  const key = buildKey(target);
  const { networkId, providerName, symbol, vault } = target;
  const [read, setRead] = useState<{ key: string; tokens?: string[] }>(() => ({
    key,
    tokens: readFirstFrame<string[]>(key, { orOlder: true }),
  }));
  useEffect(() => {
    if (!enabled || !providerName || !symbol) {
      return undefined;
    }
    let cancelled = false;
    void warmRewardTokens({ networkId, providerName, symbol, vault }).then(
      (tokens) => {
        if (!cancelled && tokens) {
          setRead({ key, tokens });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, key, networkId, providerName, symbol, vault]);
  const tokens =
    read.key === key
      ? read.tokens
      : readFirstFrame<string[]>(key, { orOlder: true });
  return enabled && tokens?.length ? tokens : undefined;
}
