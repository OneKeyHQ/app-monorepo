import { useMemo } from 'react';

import { Stack, usePageWidth } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ShareContentRenderer } from './ShareContentRenderer';

import type { IShareConfig, IShareData, IShareReferralInfo } from './types';

interface IShareViewProps extends IShareReferralInfo {
  data: IShareData;
  config: IShareConfig;
  isReferralReady?: boolean;
}

const IPAD_SHARE_IMAGE_SIZE = 350;

export function ShareView({
  data,
  config,
  referralQrCodeUrl,
  referralDisplayText,
  isReferralReady,
}: IShareViewProps) {
  const pageWidth = usePageWidth();

  const displaySize = useMemo(() => {
    if (platformEnv.isNativeIOSPad) {
      return IPAD_SHARE_IMAGE_SIZE;
    }
    return pageWidth * 0.85;
  }, [pageWidth]);

  return (
    <Stack
      width={displaySize}
      height={displaySize}
      borderRadius="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      overflow="hidden"
    >
      <ShareContentRenderer
        data={data}
        config={config}
        referralQrCodeUrl={referralQrCodeUrl}
        referralDisplayText={referralDisplayText}
        isReferralReady={isReferralReady}
        scale={displaySize / 1080}
      />
    </Stack>
  );
}
