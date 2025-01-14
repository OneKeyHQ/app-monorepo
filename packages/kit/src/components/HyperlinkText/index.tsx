/* eslint-disable react/no-unstable-nested-components */
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { type ISizableTextProps, SizableText } from '@onekeyhq/components';
import { EQRCodeHandlerNames } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

import useParseQRCode from '../../views/ScanQrCode/hooks/useParseQRCode';

export type IHyperlinkTextProps = {
  translationId?: ETranslations;
  defaultMessage?: string;
  onAction?: (url: string) => void;
  values?: Record<string, string>;
  autoHandleResult?: boolean;
} & ISizableTextProps;

export function HyperlinkText({
  translationId,
  defaultMessage,
  onAction,
  children,
  values,
  autoHandleResult = true,
  ...textProps
}: IHyperlinkTextProps) {
  const intl = useIntl();
  const parseQRCode = useParseQRCode();
  const text = useMemo(
    () =>
      translationId
        ? intl.formatMessage(
            {
              id: translationId,
              defaultMessage,
            },
            {
              ...values,
              action: (params: React.ReactNode[]) => {
                const [actionId, chunks] = params;
                return (
                  <SizableText
                    {...textProps}
                    cursor="pointer"
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    onPress={() => {
                      if (typeof actionId === 'string') {
                        onAction?.(actionId);
                      }
                    }}
                  >
                    {chunks}
                  </SizableText>
                );
              },
              url: (params: React.ReactNode[]) => {
                const [link, chunks] = params;
                return (
                  <SizableText
                    {...textProps}
                    cursor="pointer"
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    onPress={() => {
                      if (typeof link === 'string') {
                        setTimeout(() => {
                          onAction?.(link);
                        }, 0);
                        void parseQRCode.parse(link, {
                          handlers: [
                            EQRCodeHandlerNames.marketDetail,
                            EQRCodeHandlerNames.sendProtection,
                          ],
                          qrWalletScene: false,
                          autoHandleResult,
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
                <SizableText {...textProps} textDecorationLine="underline">
                  {string}
                </SizableText>
              ),
              bold: ([string]) => (
                <SizableText {...textProps} size="$headingLg">
                  {string}
                </SizableText>
              ),
              text: (chunks) => (
                <>
                  {chunks.map((chunk, index) =>
                    typeof chunk === 'string' ? (
                      <SizableText {...textProps} key={index}>
                        {chunk}
                      </SizableText>
                    ) : (
                      chunk
                    ),
                  )}
                </>
              ),
            },
          )
        : (children as string),
    [
      autoHandleResult,
      children,
      defaultMessage,
      intl,
      onAction,
      parseQRCode,
      textProps,
      translationId,
      values,
    ],
  );
  return <SizableText {...textProps}>{text}</SizableText>;
}
