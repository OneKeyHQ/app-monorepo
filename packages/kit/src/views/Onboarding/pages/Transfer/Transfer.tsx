import { useState } from 'react';

import { Page, SegmentControl, Stack } from '@onekeyhq/components';

import { TransferEnterLink } from './components/TransferEnterLink';
import { TransferQrCode } from './components/TransferQrCode';

export function Transfer() {
  const [value, setValue] = useState(1);

  return (
    <Page>
      <Page.Header title="Transfer" />
      <Page.Body>
        <Stack px="$4" gap="$4">
          <SegmentControl
            fullWidth
            value={value}
            onChange={(v) => {
              setValue(v as number);
            }}
            options={[
              { label: 'QR Code', value: 1 },
              { label: 'Enter Link', value: 2 },
            ]}
          />
          {value === 1 ? <TransferQrCode /> : <TransferEnterLink />}
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default Transfer;
