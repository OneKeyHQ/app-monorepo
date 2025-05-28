import type { FC } from 'react';

import { ScrollView, SizableText, Stack } from '@onekeyhq/components';
import type { IMarketTokenSecurity } from '@onekeyhq/shared/types/marketV2';

type ITokenSecurityAlertDialogContentProps = {
  securityData: IMarketTokenSecurity | null;
  error: string | null;
  loading: boolean;
};

const TokenSecurityAlertDialogContent: FC<
  ITokenSecurityAlertDialogContentProps
> = ({ securityData, error, loading }) => {
  return (
    <ScrollView maxHeight="$96">
      <Stack gap="$4" p="$4">
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
