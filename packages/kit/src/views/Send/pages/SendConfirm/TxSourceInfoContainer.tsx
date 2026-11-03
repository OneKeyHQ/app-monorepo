import { Stack } from '@onekeyhq/components';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { DAppSiteMark } from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';

type IProps = {
  sourceInfo: IDappSourceInfo | undefined;
};

function TxSourceInfoContainer(props: IProps) {
  const { sourceInfo } = props;

  const { urlSecurityInfo } = useRiskDetection({
    origin: sourceInfo?.origin ?? '',
    walletConnectVerifyContext: sourceInfo?.walletConnectVerifyContext,
    isWalletConnectRequest: sourceInfo?.isWalletConnectRequest,
  });

  if (!sourceInfo || !sourceInfo.origin) {
    return null;
  }

  return (
    <Stack px="$5" pt="$2">
      <DAppSiteMark
        sourceInfo={sourceInfo}
        origin={sourceInfo.origin}
        urlSecurityInfo={urlSecurityInfo}
      />
    </Stack>
  );
}

export { TxSourceInfoContainer };
