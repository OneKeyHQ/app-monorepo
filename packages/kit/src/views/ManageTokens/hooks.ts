import { useCallback, useEffect, useState } from 'react';

import type { TokenSource } from '@onekeyhq/engine/src/managers/token';
import type {
  GoPlusAddressSecurity,
  GoPlusTokenSecurity,
} from '@onekeyhq/engine/src/types/goplus';
import { GoPlusSupportApis } from '@onekeyhq/engine/src/types/goplus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { setAccountTokensBalances } from '../../store/reducers/tokens';

import type { Token } from '../../store/typings';

export const useSearchTokens = (
  terms: string,
  keyword: string,
  networkid?: string,
  accountId?: string,
) => {
  const [loading, setLoading] = useState(false);
  const [searchedTokens, setTokens] = useState<Token[]>([]);
  useEffect(() => {
    if (terms !== keyword) {
      setTokens([]);
      setLoading(true);
    }
  }, [terms, keyword]);
  useEffect(() => {
    async function main() {
      if (terms.length === 0 || !networkid || !accountId) {
        setLoading(false);
        setTokens([]);
        return;
      }
      setLoading(true);
      setTokens([]);
      let tokens = [];
      try {
        tokens = await backgroundApiProxy.engine.searchTokens(networkid, terms);
        setTokens(tokens);
      } finally {
        setLoading(false);
      }
      const [balances] = await backgroundApiProxy.engine.getAccountBalance(
        accountId,
        networkid,
        tokens.map((i) => i.tokenIdOnNetwork),
      );
      backgroundApiProxy.dispatch(
        setAccountTokensBalances({
          activeAccountId: accountId,
          activeNetworkId: networkid,
          tokensBalance: balances,
        }),
      );
    }
    main();
  }, [terms, networkid, accountId]);
  return {
    loading,
    searchedTokens,
  };
};

export const useTokenSourceList = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TokenSource[]>([]);
  useEffect(() => {
    setLoading(true);
    backgroundApiProxy.serviceToken
      .fetchTokenSource()
      .then((list) => {
        setData(list.filter((l) => l.count > 0));
      })
      .finally(() => setLoading(false));
  }, []);
  return {
    loading,
    data: data ?? [],
  };
};

export const useTokenSecurityInfo = (networkId?: string, address?: string) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    safe: (keyof GoPlusTokenSecurity)[];
    danger: (keyof GoPlusTokenSecurity)[];
    warn: (keyof GoPlusTokenSecurity)[];
    hasSecurity: boolean;
  }>({ safe: [], danger: [], warn: [], hasSecurity: false });

  const fetch = useCallback(() => {
    if (!networkId || !address) {
      return;
    }
    setLoading(true);
    backgroundApiProxy.serviceToken
      .getTokenRiskyItems({
        networkId,
        address,
        apiName: GoPlusSupportApis.token_security,
      })
      .then(setData)
      .finally(() => {
        setLoading(false);
      });
  }, [networkId, address]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    loading,
    data,
  };
};

export const useAddressSecurityInfo = (networkId: string, address: string) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<(keyof GoPlusAddressSecurity)[]>();

  const fetch = useCallback(() => {
    if (!networkId || !address) {
      return;
    }
    setLoading(true);
    backgroundApiProxy.serviceToken
      .getAddressRiskyItems({
        address,
        networkId,
        apiName: GoPlusSupportApis.address_security,
      })
      .then(setData)
      .finally(() => {
        setLoading(false);
      });
  }, [networkId, address]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    loading,
    data,
  };
};
