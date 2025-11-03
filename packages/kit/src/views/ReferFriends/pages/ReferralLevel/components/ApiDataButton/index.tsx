import { useCallback } from 'react';

import { IconButton } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

interface IApiDataButtonProps {
  data?: IInviteLevelDetail;
}

export function ApiDataButton({ data }: IApiDataButtonProps) {
  const handleShowData = useCallback(() => {
    if (data) {
      console.log('API Data:', data);
    }
  }, [data]);

  // Only show in development environment
  if (!platformEnv.isDev) {
    return null;
  }

  return (
    <IconButton
      icon="InfoCircleOutline"
      onPress={handleShowData}
      disabled={!data}
    />
  );
}
