/* eslint-disable react/no-unstable-nested-components */
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { type ISizableTextProps, SizableText } from '@onekeyhq/components';
import { EQRCodeHandlerNames } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

import useParseQRCode from '../../views/ScanQrCode/hooks/useParseQRCode';

export type IHyperlinkTextProps = {
  id: ETranslations;
  defaultMessage?: string;
} & ISizableTextProps;

export function HyperlinkText({
  id,
  defaultMessage,
  ...textProps
}: IHyperlinkTextProps) {
  const intl = useIntl();
  const parseQRCode = useParseQRCode();
  const text = useMemo(
    () =>
      intl.formatMessage(
        { id, defaultMessage },
        {
          url: (params: React.ReactNode[]) => {
            const [link, chunks] = params;
            console.log(chunks);
            return (
              <SizableText
                cursor="pointer"
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
                onPress={() => {
                  if (typeof link === 'string') {
                    void parseQRCode.parse(link, {
                      handlers: [EQRCodeHandlerNames.marketDetail],
                      qrWalletScene: false,
                      autoHandleResult: true,
                      defaultHandler: openUrlInApp,
                    });
                  }
                }}
              >
                {chunks}
              </SizableText>
            );
          },
          underline: ([string]) => (
            <SizableText textDecorationLine="underline">{string}</SizableText>
          ),
          bold: ([string]) => (
            <SizableText size="$headingLg">{string}</SizableText>
          ),
          text: (chunks) => {
            console.log('chunks', chunks);
            return (
              <>
                {chunks.map((chunk, index) =>
                  typeof chunk === 'string' ? (
                    <SizableText key={index}>{chunk}</SizableText>
                  ) : (
                    chunk
                  ),
                )}
              </>
            );
          },
        },
      ),
    [defaultMessage, id, intl, parseQRCode],
  );
  return <SizableText {...textProps}>{text}</SizableText>;
}
