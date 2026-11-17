import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog/hooks';
import { useTermsAndPrivacyLinks } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IntlShape } from 'react-intl';

// Small centered "OneKey Terms of Use" link for the bottom of an explainer
// dialog. It closes the dialog first so the dialog is not left open behind
// the page it opens.
export function DialogTermsOfUseLink({
  intl,
  testID,
}: {
  intl: IntlShape;
  testID?: string;
}) {
  const dialogInstance = useDialogInstance();
  const { termsUrl } = useTermsAndPrivacyLinks();
  const openTermsOfUse = async () => {
    await dialogInstance.close();
    openUrlExternal(termsUrl);
  };

  return (
    <XStack
      testID={testID}
      alignSelf="center"
      alignItems="center"
      gap="$1"
      cursor="pointer"
      hoverStyle={{ opacity: 0.8 }}
      pressStyle={{ opacity: 0.7 }}
      onPress={() => {
        void openTermsOfUse();
      }}
    >
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        textDecorationLine="underline"
      >
        {intl.formatMessage({
          id: ETranslations.onekey_terms_of_use__action,
        })}
      </SizableText>
      <Icon name="OpenOutline" size="$3.5" color="$iconSubdued" />
    </XStack>
  );
}
