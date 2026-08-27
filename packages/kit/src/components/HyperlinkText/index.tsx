/* eslint-disable react/no-unstable-nested-components */
import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { createIntl, useIntl } from 'react-intl';

import {
  type ISizableTextProps,
  SizableText,
  getFontSize,
} from '@onekeyhq/components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';
import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';

import useParseQRCodeLazy from '../../views/ScanQrCode/hooks/useParseQRCodeLazy';

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
  /**
   * Awaited before a url/urlInApp link opens. For a link inside a dialog that
   * has to get out of the way first: `onAction` fires in a detached timeout, so
   * a dismissal started there races the navigation instead of preceding it.
   */
  onBeforeOpenUrl?: () => void | Promise<void>;
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
  onBeforeOpenUrl,
  urlTextProps,
  actionTextProps,
  underlineTextProps,
  subscriptsTextProps,
  boldTextProps,
  textProps,
  ...basicTextProps
}: IHyperlinkTextProps) {
  const intl = useIntl();
  const parseQRCode = useParseQRCodeLazy();
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

  // Clamping belongs to the wrapper element only. Spreading it onto the tag
  // elements too is what made rich text fall apart on web: Tamagui's Text turns
  // `numberOfLines >= 2` into `display: -webkit-box`, so a nested <bold>/<red>
  // stopped being inline and broke onto a line of its own, with the runs before
  // and after it on separate lines again. `ellipse` carries the same kind of
  // overflow styling, so it is withheld as well. Native is unaffected — its
  // text engine clamps nested Text without any of this — which is why the
  // symptom only shows on web and desktop.
  const { numberOfLines, ellipse, ...inlineTextProps } = basicTextProps;

  const renderUrlChunk = useCallback(
    (
      params: React.ReactNode[],
      {
        openWith = openUrlExternal,
        showExternalIndicator = true,
      }: {
        openWith?: (link: string) => void;
        showExternalIndicator?: boolean;
      } = {},
    ) => {
      const [link, chunks] = params;
      const isLinkString = typeof link === 'string';
      return (
        <SizableText
          {...inlineTextProps}
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
              void (async () => {
                await onBeforeOpenUrl?.();
                await parseQRCode.parse(link, {
                  handlers: [
                    EQRCodeHandlerNames.marketDetail,
                    EQRCodeHandlerNames.sendProtection,
                    EQRCodeHandlerNames.rewardCenter,
                    EQRCodeHandlerNames.updatePreview,
                  ],
                  qrWalletScene: false,
                  autoExecuteParsedAction,
                  // OneKey deeplinks still resolve natively above; only a plain
                  // web link reaches this.
                  defaultHandler: openWith,
                });
              })();
            }
          }}
        >
          {isLinkString ? chunks : link}
          {autoExecuteParsedAction && showExternalIndicator ? ' ↗' : null}
        </SizableText>
      );
    },
    [
      inlineTextProps,
      urlTextProps,
      onAction,
      onBeforeOpenUrl,
      parseQRCode,
      autoExecuteParsedAction,
    ],
  );

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
                    {...inlineTextProps}
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
              url: renderUrlChunk,
              // Same link, opened inside the app so the page can talk to the
              // wallet and closing it lands back on the page the link was on.
              // <url> keeps handing plain web links to the system browser.
              urlInApp: (params: React.ReactNode[]) =>
                renderUrlChunk(params, {
                  openWith: (link) => {
                    // The link comes from remote config, so apply the same
                    // policy the WebView overlay uses (https, no credentials,
                    // no local address, no punycode) before hosting it.
                    if (!isAllowedWebViewUrl(link)) {
                      openUrlExternal(link);
                      return;
                    }
                    openUrlInApp(link, undefined, { enableDappBridge: true });
                  },
                  // The arrow reads as "leaves the app", which this one does not.
                  showExternalIndicator: false,
                }),
              subscripts: ([string]) => (
                <SizableText
                  {...inlineTextProps}
                  fontSize={scriptFontSize}
                  {...subscriptsTextProps}
                >
                  {string}
                </SizableText>
              ),
              underline: ([string]) => (
                <SizableText
                  {...inlineTextProps}
                  {...underlineTextProps}
                  textDecorationLine="underline"
                >
                  {string}
                </SizableText>
              ),
              bold: ([string]) => (
                <SizableText
                  {...inlineTextProps}
                  {...boldTextProps}
                  fontWeight="600"
                >
                  {string}
                </SizableText>
              ),
              // Semantic color tags. Deliberately no per-color
              // `*TextProps` escape hatch: five more ISizableTextProps would
              // bloat an already-wide prop type and drag five more entries
              // into the memo deps, while `<text>` + textProps already covers
              // a caller that needs an arbitrary color. The tokens are
              // theme-aware, so these follow light/dark on their own.
              red: ([string]) => (
                <SizableText {...inlineTextProps} color="$textCritical">
                  {string}
                </SizableText>
              ),
              green: ([string]) => (
                <SizableText {...inlineTextProps} color="$textSuccess">
                  {string}
                </SizableText>
              ),
              yellow: ([string]) => (
                <SizableText {...inlineTextProps} color="$textCaution">
                  {string}
                </SizableText>
              ),
              blue: ([string]) => (
                <SizableText {...inlineTextProps} color="$textInfo">
                  {string}
                </SizableText>
              ),
              grey: ([string]) => (
                <SizableText {...inlineTextProps} color="$textSubdued">
                  {string}
                </SizableText>
              ),
              text: (chunks) => (
                <>
                  {chunks.map((chunk, index) =>
                    typeof chunk === 'string' ? (
                      <SizableText
                        {...inlineTextProps}
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
      inlineTextProps,
      actionTextProps,
      onAction,
      renderUrlChunk,
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
