import { useMemo } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';

import DAppRiskyAlert from './DAppRiskyAlert';
import DAppSiteMark from './DAppSiteMark';

function DAppRequestHeader() {
  const content = useMemo(() => 'Hello World', []);

  return (
    <Stack>
      <DAppRiskyAlert />
      <Stack p="$5" space="$8">
        <Stack space="$2.5">
          <DAppSiteMark riskyLevel="Verified" />
          <SizableText color="$text" size="$heading3xl">
            Connection Request
          </SizableText>
        </Stack>
      </Stack>
    </Stack>
  );
}

export default DAppRequestHeader;
