import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { normalizeToEarnProvider } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IEarnTokenInfo } from '@onekeyhq/shared/types/staking';

import { EarnNavigation } from '../../../earnUtils';

interface IUseProtocolDetailBreadcrumbParams {
  accountReady?: boolean;
  accountId?: string;
  indexedAccountId?: string;
  networkId: string;
  symbol: string;
  provider: string;
  tokenInfo?: IEarnTokenInfo;
}

export function useProtocolDetailBreadcrumb({
  accountReady,
  accountId,
  indexedAccountId,
  networkId,
  symbol,
  provider,
  tokenInfo,
}: IUseProtocolDetailBreadcrumbParams) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  // Fetch protocol list to determine if there are multiple protocols for this token
  const { result: protocolList } = usePromiseResult(async () => {
    if (
      !symbol ||
      !accountReady ||
      (!accountId && !indexedAccountId) ||
      !networkId
    ) {
      return [];
    }

    try {
      const data = await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol,
        accountId,
        indexedAccountId,
        networkId,
      });
      return data || [];
    } catch (_error) {
      return [];
    }
  }, [symbol, accountReady, accountId, indexedAccountId, networkId]);

  const hasMultipleProtocols = useMemo(
    () => (protocolList?.length ?? 0) > 1,
    [protocolList],
  );

  const breadcrumbProps = useMemo(() => {
    const items: Array<{ label: string; onClick?: () => void }> = [
      {
        label: intl.formatMessage({ id: ETranslations.global_earn }),
        onClick: () => {
          void EarnNavigation.popToEarnHome(appNavigation);
        },
      },
    ];

    // If there are multiple protocols, add a middle breadcrumb to protocol list
    if (hasMultipleProtocols && tokenInfo?.token?.logoURI) {
      const currentProtocol = protocolList?.find(
        (item) => item.provider.name === provider,
      );
      const rawCategory = currentProtocol?.provider.category?.trim();
      let defaultCategory: 'simpleEarn' | 'fixedRate' | undefined;
      if (rawCategory === 'simpleEarn' || rawCategory === 'fixedRate') {
        defaultCategory = rawCategory;
      } else if (earnUtils.isPendleProvider({ providerName: provider })) {
        defaultCategory = 'fixedRate';
      }
      items.push({
        label: symbol,
        onClick: () => {
          EarnNavigation.pushToEarnProtocols(appNavigation, {
            symbol,
            logoURI: encodeURIComponent(tokenInfo.token.logoURI),
            defaultCategory,
          });
        },
      });
      items.push({
        label: normalizeToEarnProvider(provider) || provider,
      });
    } else {
      // Only two levels: Earn > Symbol
      items.push({ label: symbol });
    }

    return { items };
  }, [
    intl,
    symbol,
    provider,
    appNavigation,
    hasMultipleProtocols,
    protocolList,
    tokenInfo?.token?.logoURI,
  ]);

  return {
    breadcrumbProps,
    hasMultipleProtocols,
    protocolList,
  };
}
