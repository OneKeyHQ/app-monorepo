import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog/hooks';
import { useTermsAndPrivacyLinks } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IntlShape } from 'react-intl';

// Small centered "OneKey Terms of Use" link for the bottom of an explainer
// dialog. It closes the dialog so the dialog is not left open behind the page
// it opens.
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
    if (platformEnv.isNative) {
      // iOS drops an in-app browser presented on top of a dialog that is
      // still dismissing, so native waits for the close.
      await dialogInstance.close();
      openUrlExternal(termsUrl);
      return;
    }
    // The dialog resolves its close from the exit animation or a timer, and
    // web popup blockers only honour window.open while the click still holds
    // user activation, so web opens the page without waiting.
    void dialogInstance.close();
    openUrlExternal(termsUrl);
  };

  return (
    <XStack
      testID={testID}
      alignSelf="center"
      alignItems="center"
      gap="$1"
      cursor="pointer"
      role="link"
      hoverStyle={{ opacity: 0.8 }}
      pressStyle={{ opacity: 0.7 }}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: 2,
      }}
      onPress={() => {
        void openTermsOfUse();
      }}
      {...(!platformEnv.isNative && {
        tabIndex: 0,
        onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          event.stopPropagation();
          void openTermsOfUse();
        },
      })}
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
