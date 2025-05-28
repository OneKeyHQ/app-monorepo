import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { ScrollView, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenSecurity } from '@onekeyhq/shared/types/marketV2';

type ITokenSecurityAlertDialogContentProps = {
  tokenAddress?: string;
  networkId: string;
};

const TokenSecurityAlertDialogContent: FC<
  ITokenSecurityAlertDialogContentProps
> = ({ tokenAddress, networkId }) => {
  const [securityData, setSecurityData] = useState<IMarketTokenSecurity | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTokenSecurity = async () => {
      if (!tokenAddress) {
        console.log('No token address provided');
        setError('No token address provided');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenSecurity(
            tokenAddress,
            networkId,
          );
        console.log('Token security data:', data);
        setSecurityData(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch token security';
        console.error('Failed to fetch token security:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    void fetchTokenSecurity();
  }, [tokenAddress, networkId]);

  return (
    <ScrollView maxHeight="$96">
      <Stack space="$4" p="$4">
        {loading ? <SizableText>Loading...</SizableText> : null}
        {error ? (
          <SizableText color="$textCritical">{error}</SizableText>
        ) : null}
        {securityData ? (
          <SizableText>{JSON.stringify(securityData, null, 2)}</SizableText>
        ) : null}
      </Stack>
    </ScrollView>
  );
};

export { TokenSecurityAlertDialogContent };
