import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Anchor, SizableText, useMedia } from '@onekeyhq/components';
import { useTermsAndPrivacyLinks } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { FormatXMLElementFn } from 'intl-messageformat';

interface ITermsAndPrivacyProps {
  contentContainerProps?: Omit<IStackProps, 'children'>;
  testID?: string;
  // Must keep the termsTag and privacyTag placeholders.
  messageId?: ETranslations;
}

export function TermsAndPrivacy(props?: ITermsAndPrivacyProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { termsUrl: termsLink, privacyUrl: privacyLink } =
    useTermsAndPrivacyLinks();

  const renderAnchor = useCallback(
    (link: string, chunks: string[]) =>
      // Due to bugs such as the onPress event of the Text component,
      //  only the last of multiple Anchors will take effect.
      platformEnv.isNative ? (
        <SizableText
          onPress={() => {
            openUrlExternal(link);
          }}
          size="$bodySm"
          textDecorationLine="underline"
          color="$text"
        >
          {chunks[0]}
        </SizableText>
      ) : (
        <Anchor
          href={link}
          size="$bodySm"
          color="$text"
          target="_blank"
          showExternalIndicator={false}
          $gtMd={{
            size: '$bodyMd',
          }}
        >
          {chunks}
        </Anchor>
      ),
    [],
  );

  const renderTermsTag: FormatXMLElementFn<string, any> = useCallback(
    (chunks: string[]) => renderAnchor(termsLink, chunks),
    [renderAnchor, termsLink],
  );

  const renderPrivacyTag: FormatXMLElementFn<string, any> = useCallback(
    (chunks: string[]) => renderAnchor(privacyLink, chunks),
    [privacyLink, renderAnchor],
  );

  const { $gtMd: userGtMd, ...restContentProps } =
    props?.contentContainerProps ?? {};

  return (
    <SizableText
      testID={props?.testID}
      alignSelf="center"
      size="$bodySm"
      color="$textSubdued"
      textAlign="center"
      $gtMd={{
        size: '$bodyMd',
        alignSelf: 'flex-start',
        ...(userGtMd as any),
      }}
      {...(restContentProps as any)}
    >
      {intl.formatMessage(
        { id: props?.messageId ?? ETranslations.terms_privacy },
        {
          termsTag: renderTermsTag,
          privacyTag: renderPrivacyTag,
          br: () => (gtMd ? ' ' : '\n'),
        },
      )}
    </SizableText>
  );
}
