import { useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
} from '@onekeyhq/shared/types/token';

import type { IDustSweepCandidate } from '../stateMachine';

function toCandidate(
  token: IAccountToken,
  response: IFetchAccountTokensResp,
): IDustSweepCandidate {
  const value =
    response.smallBalanceTokens.map[token.$key] ??
    response.tokens.map[token.$key] ??
    response.riskTokens.map[token.$key];
  return {
    ...token,
    fiatValue: value?.fiatValue ?? '0',
    balance: value?.balance,
    balanceParsed: value?.balanceParsed,
  };
}

export function useDustSweepCandidates() {
  const {
    activeAccount: { account, network, indexedAccount, ready },
  } = useActiveAccount({ num: 0 });
  const [response, setResponse] = useState<IFetchAccountTokensResp>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const generationRef = useRef(0);

  useEffect(() => {
    if (!ready || !account?.id || !network?.id) return;
    let mounted = true;
    setLoading(true);
    setError(undefined);
    setResponse(undefined);
    generationRef.current += 1;
    void backgroundApiProxy.serviceToken
      .fetchAccountTokens({
        accountId: account.id,
        networkId: network.id,
        indexedAccountId: indexedAccount?.id,
        hideSmallBalanceTokens: false,
        hideRiskTokens: true,
        excludeDeFiMarkedTokens: true,
        withoutDappToken: true,
        isManualRefresh: false,
        saveToLocal: false,
      })
      .then((nextResponse) => {
        if (mounted) setResponse(nextResponse);
      })
      .catch((nextError: unknown) => {
        if (mounted) {
          setError(
            nextError instanceof Error
              ? nextError
              : new Error(String(nextError)),
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [account?.id, indexedAccount?.id, network?.id, ready]);

  const candidates = useMemo(() => {
    if (!response) return [];
    return response.smallBalanceTokens.data
      .filter((token) => !token.isNative && Boolean(token.address))
      .map((token) => {
        const candidate = toCandidate(token, response);
        return {
          ...candidate,
          hidden: Number(candidate.fiatValue) < 0.01,
        };
      });
  }, [response]);

  const targetToken = useMemo(
    () =>
      response?.tokens.data.find((token) => token.isNative) ??
      response?.smallBalanceTokens.data.find((token) => token.isNative),
    [response],
  );

  return {
    candidates,
    targetToken: targetToken
      ? toCandidate(targetToken, response as IFetchAccountTokensResp)
      : undefined,
    loading,
    error,
    generation: generationRef.current,
    account,
    network,
  };
}
