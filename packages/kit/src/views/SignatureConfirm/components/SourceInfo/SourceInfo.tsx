import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { DAppSiteMark } from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';

type IProps = {
  sourceInfo: IDappSourceInfo | undefined;
};

function SourceInfo(props: IProps) {
  const { sourceInfo } = props;

  const { urlSecurityInfo } = useRiskDetection({
    origin: sourceInfo?.origin ?? '',
  });

  if (!sourceInfo || !sourceInfo.origin) {
    return null;
  }

  return (
    <Stack mb="$5">
      <DAppSiteMark
        origin={sourceInfo.origin}
        urlSecurityInfo={urlSecurityInfo}
      />
    </Stack>
  );
}

export default memo(SourceInfo);
