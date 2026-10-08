import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Anchor, SizableText } from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { FormatXMLElementFn } from 'intl-messageformat';

export function PrimeTermsAndPrivacy() {
  const intl = useIntl();
  const termsLink = useHelpLink({
    path: 'articles/11461297',
  });
  const privacyLink = useHelpLink({
    path: 'articles/11461298',
  });

  const renderAnchor = useCallback(
    (link: string, chunks: string[]) =>
      // Due to bugs such as the onPress event of the Text component,
      //  only the last of multiple Anchors will take effect.
      platformEnv.isNative ? (
        <SizableText
          accessibilityRole="link"
          onPress={() => {
            openUrlInApp(link, chunks[0]);
          }}
          size="$bodyMd"
          color="$textInteractive"
          pressStyle={{ opacity: 0.8 }}
        >
          {chunks[0]}
        </SizableText>
      ) : (
        <Anchor
          href={link}
          size="$bodyMd"
          color="$textInteractive"
          target={platformEnv.isDesktop ? '_self' : '_blank'}
          rel={platformEnv.isDesktop ? undefined : 'noopener noreferrer'}
          showExternalIndicator={false}
          textDecorationLine="none"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.8 }}
          onPress={
            platformEnv.isDesktop
              ? (event) => {
                  event.preventDefault();
                  openUrlInApp(link, chunks[0]);
                }
              : undefined
          }
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

  return (
    <SizableText
      size="$bodyMd"
      width="100%"
      color="$textSubdued"
      textAlign="left"
    >
      {intl.formatMessage(
        { id: ETranslations.prime_agree_to_terms_privacy },
        {
          termsTag: renderTermsTag,
          privacyTag: renderPrivacyTag,
        },
      )}
    </SizableText>
  );
}
