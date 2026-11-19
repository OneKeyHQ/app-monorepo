import { type ReactNode, useId } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  DialogContainer,
} from '@onekeyhq/components/src/composite/Dialog';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function SignInErrorDialog({
  title,
  description,
  references,
  onDismiss,
}: {
  title: string;
  description?: string;
  references: ReactNode;
  onDismiss: () => void;
}) {
  const intl = useIntl();
  const dismiss = intl.formatMessage({ id: ETranslations.global_got_it });
  const titleId = useId();
  const descriptionId = useId();

  return (
    <DialogContainer
      onClose={() => {
        onDismiss();
        return Promise.resolve();
      }}
      modal
      title={title}
      showHeader={false}
      showFooter={false}
      onConfirmText={dismiss}
      onCancelText={intl.formatMessage({ id: ETranslations.global_cancel })}
      dismissOnOverlayPress={false}
      disableDrag
      renderContent={
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <YStack pt="$5" gap="$3">
            <YStack>
              <Dialog.Title tag="h2" nativeID={titleId}>
                {title}
              </Dialog.Title>
              <Dialog.Description nativeID={descriptionId}>
                {description}
              </Dialog.Description>
            </YStack>
            {references}
            <Button
              testID="dismiss-sign-in-error"
              size="large"
              variant="primary"
              onPress={onDismiss}
            >
              {dismiss}
            </Button>
          </YStack>
        </div>
      }
    />
  );
}
