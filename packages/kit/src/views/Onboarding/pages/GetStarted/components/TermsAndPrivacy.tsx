import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Anchor, SizableText } from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { FormatXMLElementFn } from 'intl-messageformat';

interface ITermsAndPrivacyProps {
  contentContainerProps?: Omit<IStackProps, 'children'>;
}

export function TermsAndPrivacy(props?: ITermsAndPrivacyProps) {
  const intl = useIntl();
  const termsLink = useHelpLink({
    path: 'articles/11461297',
  });
  const privacyLink = useHelpLink({ path: 'articles/11461298' });

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
        >
          {chunks[0]}
        </SizableText>
      ) : (
        <Anchor
          href={link}
          size="$bodySm"
          color="$text"
          target="_blank"
          textDecorationLine="none"
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
      size="$bodySm"
      color="$textDisabled"
      textAlign="center"
      p="$5"
      pt="$0"
      {...props?.contentContainerProps}
    >
      {intl.formatMessage(
        { id: ETranslations.terms_privacy },
        {
          termsTag: renderTermsTag,
          privacyTag: renderPrivacyTag,
        },
      )}
    </SizableText>
  );
}
