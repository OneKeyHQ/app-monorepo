import type { PropsWithChildren } from 'react';

import { SizableText, Stack, useSafeAreaInsets } from '@onekeyhq/components';

import { DAppRiskyAlert } from './DAppRiskyAlert';
import { DAppSiteMark } from './DAppSiteMark';

import type { IRiskLevel } from '../../types';

function DAppRequestLayout({
  title,
  origin,
  riskLevel,
  children,
}: PropsWithChildren<{
  title: string;
  origin: string;
  riskLevel: IRiskLevel;
}>) {
  const { top } = useSafeAreaInsets();
  return (
    <Stack
      $md={{
        mt: top,
      }}
    >
      <DAppRiskyAlert riskLevel={riskLevel} />
      <Stack p="$5" space="$8">
        <Stack space="$2.5">
          <DAppSiteMark origin={origin} riskLevel={riskLevel} />
          <SizableText color="$text" size="$heading3xl">
            {title}
          </SizableText>
        </Stack>
        {children}
      </Stack>
    </Stack>
  );
}

export { DAppRequestLayout };
