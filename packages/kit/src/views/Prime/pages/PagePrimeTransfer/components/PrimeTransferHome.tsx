/* eslint-disable spellcheck/spell-checker */
import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ISegmentControlProps } from '@onekeyhq/components';
import {
  Divider,
  Page,
  SegmentControl,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PrimeTransferHomeEnterLink } from './PrimeTransferHomeEnterLink';
import { PrimeTransferHomeQrCode } from './PrimeTransferHomeQrCode';
import { PrimeTransferHomeSteps } from './PrimeTransferHomeSteps';
import { PrimeTransferServerStatusBar } from './PrimeTransferServerStatusBar';

export const TRANSFER_METHOD = {
  QR_CODE: 'qr-code',
  ENTER_LINK: 'enter-link',
} as const;

const { QR_CODE, ENTER_LINK } = TRANSFER_METHOD;

type ITransferMethod = (typeof TRANSFER_METHOD)[keyof typeof TRANSFER_METHOD];

export function PrimeTransferHome({
  remotePairingCode,
  setRemotePairingCode,
}: {
  remotePairingCode: string;
  setRemotePairingCode: (code: string) => void;
}) {
  const [primeTransferAtom] = usePrimeTransferAtom();

  const intl = useIntl();
  const TRANSFER_OPTIONS = useMemo(
    () =>
      [
        {
          label: intl.formatMessage({ id: ETranslations.global_qr_code }),
          value: QR_CODE,
          testID: QR_CODE,
        },
        {
          label: intl.formatMessage({ id: ETranslations.global_links }),
          value: ENTER_LINK,
          testID: ENTER_LINK,
        },
      ] as ISegmentControlProps['options'],
    [intl],
  );

  const [value, setValue] = useState<ITransferMethod>(QR_CODE);

  return (
    <>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.transfer_establish_connection,
        })}
      />

      <PrimeTransferServerStatusBar />

      <Stack px="$4" gap="$5" mt="$2">
        <SegmentControl
          fullWidth
          value={value}
          onChange={(v) => {
            setValue(v as ITransferMethod);
          }}
          options={TRANSFER_OPTIONS}
        />

        <Stack display={value === QR_CODE ? 'flex' : 'none'}>
          <PrimeTransferHomeQrCode />
        </Stack>
        <Stack display={value === ENTER_LINK ? 'flex' : 'none'}>
          <PrimeTransferHomeEnterLink
            remotePairingCode={remotePairingCode}
            setRemotePairingCode={setRemotePairingCode}
          />
        </Stack>

        <PrimeTransferHomeSteps />

        <Divider />

        <YStack gap="$1.5">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.transfer_qr_stepall_desc })}
          </SizableText>
          <HyperlinkText
            size="$bodySm"
            color="$textSubdued"
            translationId={ETranslations.transfer_qr_stepall_desc2}
          />
        </YStack>
        <Stack h="$4" />
      </Stack>
    </>
  );
}
