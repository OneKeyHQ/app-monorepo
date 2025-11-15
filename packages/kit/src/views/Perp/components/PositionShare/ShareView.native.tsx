import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import { Stack } from '@onekeyhq/components';

import { ShareContentRenderer } from './ShareContentRenderer';

import type { IShareConfig, IShareData } from './types';

interface IShareViewProps {
  data: IShareData;
  config: IShareConfig;
}

export function ShareView({ data, config }: IShareViewProps) {
  const { width: screenWidth } = useWindowDimensions();

  const displaySize = useMemo(() => screenWidth * 0.85, [screenWidth]);

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
        scale={displaySize / 1080}
      />
    </Stack>
  );
}
