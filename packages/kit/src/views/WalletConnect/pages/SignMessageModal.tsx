import { useMemo } from 'react';

import { Page, SizableText, Stack } from '@onekeyhq/components';

function SignMessageModal() {
  const foo = useMemo(() => `1`, []);
  return (
    <Page>
      <Page.Header title="WalletConnect Sessions" />
      <Page.Body>
        <Stack>
          <SizableText>{foo}</SizableText>
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default SignMessageModal;
