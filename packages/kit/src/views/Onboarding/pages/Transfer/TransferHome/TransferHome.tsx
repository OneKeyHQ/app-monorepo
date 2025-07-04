import { useState } from 'react';

import type { ISegmentControlProps } from '@onekeyhq/components';
import {
  Divider,
  Page,
  SegmentControl,
  SizableText,
  Stack,
} from '@onekeyhq/components';

import { TransferEnterLink } from './components/TransferEnterLink';
import { TransferQrCode } from './components/TransferQrCode';
import { TransferSteps } from './components/TransferSteps';

export const TRANSFER_METHOD = {
  QR_CODE: 'qr-code',
  ENTER_LINK: 'enter-link',
} as const;

const { QR_CODE, ENTER_LINK } = TRANSFER_METHOD;

type ITransferMethod = (typeof TRANSFER_METHOD)[keyof typeof TRANSFER_METHOD];

export function TransferHome() {
  const TRANSFER_OPTIONS = [
    {
      label: 'QR Code',
      value: QR_CODE,
      testID: QR_CODE,
    },
    {
      label: 'Enter Link',
      value: ENTER_LINK,
      testID: ENTER_LINK,
    },
  ] as ISegmentControlProps['options'];

  const [value, setValue] = useState<ITransferMethod>(QR_CODE);

  return (
    <Page>
      <Page.Header title="TransferHome" />
      <Page.Body>
        <Stack px="$4" gap="$4">
          <SegmentControl
            fullWidth
            value={value}
            onChange={(v) => {
              setValue(v as ITransferMethod);
            }}
            options={TRANSFER_OPTIONS}
          />

          {value === QR_CODE ? <TransferQrCode /> : <TransferEnterLink />}

          <TransferSteps />

          <Divider />

          <SizableText size="$bodySm" color="$textSubdued">
            OneKey doesn't back up hardware wallets, please record and safeguard
            your recovery phrase.
          </SizableText>
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default TransferHome;
