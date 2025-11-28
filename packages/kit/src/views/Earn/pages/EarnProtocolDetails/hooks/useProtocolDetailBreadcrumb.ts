import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import { normalizeToEarnProvider } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IEarnTokenInfo } from '@onekeyhq/shared/types/staking';

import { EarnNavigation } from '../../../earnUtils';

interface IUseProtocolDetailBreadcrumbParams {
  accountId?: string;
  indexedAccountId?: string;
  symbol: ISupportedSymbol;
  provider: string;
  tokenInfo?: IEarnTokenInfo;
}

export function useProtocolDetailBreadcrumb({
  symbol,
  provider,
  tokenInfo,
}: IUseProtocolDetailBreadcrumbParams) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  // Fetch protocol list to determine if there are multiple protocols for this token
  const { result: protocolList } = usePromiseResult(async () => {
    if (!symbol) {
      return [];
    }

    try {
      const data = await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol,
      });
      return data || [];
    } catch (error) {
      return [];
    }
  }, [symbol]);

  const hasMultipleProtocols = useMemo(
    () => (protocolList?.length ?? 0) > 1,
    [protocolList],
  );

  const breadcrumbProps = useMemo(() => {
    const items: Array<{ label: string; onClick?: () => void }> = [
      {
        label: intl.formatMessage({ id: ETranslations.global_earn }),
        onClick: () => {
          EarnNavigation.pushToEarnHome(appNavigation);
        },
      },
    ];

    // If there are multiple protocols, add a middle breadcrumb to protocol list
    if (hasMultipleProtocols && tokenInfo?.token?.logoURI) {
      items.push({
        label: symbol,
        onClick: () => {
          EarnNavigation.pushToEarnProtocols(appNavigation, {
            symbol,
            logoURI: encodeURIComponent(tokenInfo.token.logoURI),
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
    tokenInfo?.token?.logoURI,
  ]);

  return {
    breadcrumbProps,
    hasMultipleProtocols,
    protocolList,
  };
}
