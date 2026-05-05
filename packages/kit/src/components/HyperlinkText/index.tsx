/* eslint-disable react/no-unstable-nested-components */
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { createIntl, useIntl } from 'react-intl';

import {
  type ISizableTextProps,
  SizableText,
  getFontSize,
} from '@onekeyhq/components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';

import useParseQRCode from '../../views/ScanQrCode/hooks/useParseQRCode';

import type { FontSizeTokens } from 'tamagui';

export type IHyperlinkTextProps = {
  translationId?: ETranslations;
  defaultMessage?: string;
  onAction?: (url: string) => void;
  messages?: Record<string, string>;
  values?: Record<
    string,
    string | ReactElement | ((v: string) => ReactElement | string)
  >;
  /**
   * Whether a recognized URL should trigger built-in navigation/action side
   * effects immediately, instead of returning parsed data for the caller.
   */
  autoExecuteParsedAction?: boolean;
  urlTextProps?: ISizableTextProps;
  actionTextProps?: ISizableTextProps;
  underlineTextProps?: ISizableTextProps;
  boldTextProps?: ISizableTextProps;
  textProps?: ISizableTextProps;
  subscriptsTextProps?: ISizableTextProps;
  scoped?: boolean;
} & ISizableTextProps;

let defaultIntl: ReturnType<typeof createIntl> | undefined;
function getDefaultIntl() {
  if (!defaultIntl) {
    defaultIntl = createIntl({
      locale: '',
    });
  }
  return defaultIntl;
}

export function HyperlinkText({
  translationId,
  defaultMessage,
  scoped,
  onAction,
  children,
  values,
  // HyperlinkText is action-oriented, so auto execution is enabled by default.
  autoExecuteParsedAction = true,
  urlTextProps,
  actionTextProps,
  underlineTextProps,
  subscriptsTextProps,
  boldTextProps,
  textProps,
  ...basicTextProps
}: IHyperlinkTextProps) {
  const intl = useIntl();
  const parseQRCode = useParseQRCode();
  const scriptFontSize = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      basicTextProps.fontSize !== 'unset'
        ? Math.ceil(
            (basicTextProps.fontSize as number) ||
              getFontSize(basicTextProps.size as FontSizeTokens) * 0.6,
          )
        : basicTextProps.fontSize,
    [basicTextProps.fontSize, basicTextProps.size],
  );

  const theIntl = scoped ? getDefaultIntl() : intl;

  const text = useMemo(
    () =>
      translationId || defaultMessage
        ? theIntl.formatMessage(
            {
              id: translationId || (defaultMessage as ETranslations),
              defaultMessage,
            },
            {
              ...values,
              action: (params: React.ReactNode[]) => {
                const [actionId, chunks] = params;
                const isActionIdString = typeof actionId === 'string';
                return (
                  <SizableText
                    {...basicTextProps}
                    {...actionTextProps}
                    cursor="pointer"
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    onPress={() => {
                      if (isActionIdString) {
                        onAction?.(actionId);
                      }
                    }}
                  >
                    {isActionIdString ? chunks : actionId}
                  </SizableText>
                );
              },
              url: (params: React.ReactNode[]) => {
                const [link, chunks] = params;
                const isLinkString = typeof link === 'string';
                return (
                  <SizableText
                    {...basicTextProps}
                    textDecorationLine="underline"
                    {...urlTextProps}
                    cursor="pointer"
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    onPress={() => {
                      setTimeout(() => {
                        onAction?.(isLinkString ? link : '');
                      }, 0);
                      if (isLinkString) {
                        void parseQRCode.parse(link, {
                          handlers: [
                            EQRCodeHandlerNames.marketDetail,
                            EQRCodeHandlerNames.sendProtection,
                            EQRCodeHandlerNames.rewardCenter,
                            EQRCodeHandlerNames.updatePreview,
                          ],
                          qrWalletScene: false,
                          autoExecuteParsedAction,
                          defaultHandler: openUrlExternal,
                        });
                      }
                    }}
                  >
                    {isLinkString ? chunks : link}
                    {autoExecuteParsedAction ? ' ↗' : null}
                  </SizableText>
                );
              },
              subscripts: ([string]) => (
                <SizableText
                  {...basicTextProps}
                  fontSize={scriptFontSize}
                  {...subscriptsTextProps}
                >
                  {string}
                </SizableText>
              ),
              underline: ([string]) => (
                <SizableText
                  {...basicTextProps}
                  {...underlineTextProps}
                  textDecorationLine="underline"
                >
                  {string}
                </SizableText>
              ),
              bold: ([string]) => (
                <SizableText
                  {...basicTextProps}
                  {...boldTextProps}
                  fontWeight="600"
                >
                  {string}
                </SizableText>
              ),
              text: (chunks) => (
                <>
                  {chunks.map((chunk, index) =>
                    typeof chunk === 'string' ? (
                      <SizableText
                        {...basicTextProps}
                        {...textProps}
                        key={index}
                      >
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
      translationId,
      defaultMessage,
      theIntl,
      values,
      children,
      basicTextProps,
      actionTextProps,
      onAction,
      urlTextProps,
      parseQRCode,
      autoExecuteParsedAction,
      scriptFontSize,
      subscriptsTextProps,
      underlineTextProps,
      boldTextProps,
      textProps,
    ],
  );
  return <SizableText {...basicTextProps}>{text}</SizableText>;
}

export function FormatHyperlinkText({
  children,
  ...props
}: Omit<IHyperlinkTextProps, 'translationId' | 'defaultMessage' | 'scoped'> & {
  children?: string;
}) {
  return children ? (
    <HyperlinkText scoped defaultMessage={children} {...props} />
  ) : null;
}
