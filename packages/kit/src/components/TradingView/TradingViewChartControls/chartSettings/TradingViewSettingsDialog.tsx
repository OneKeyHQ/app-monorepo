import type { ReactNode, RefObject } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { Button, DialogContainer, YStack } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import { Footer as DialogFooter } from '@onekeyhq/components/src/composite/Dialog/Footer';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type ITradingViewSettingsDialogRef = RefObject<IDialogInstance | null>;

export function TradingViewSettingsDialog({
  children,
  dialogRef,
  title,
  testID,
  testIDPrefix,
  isSubmitting = false,
  onReset,
  onCancel,
  onClose,
  onConfirm,
}: {
  children: (footer: ReactNode) => ReactNode;
  dialogRef?: ITradingViewSettingsDialogRef;
  title: string;
  testID: string;
  testIDPrefix: string;
  isSubmitting?: boolean;
  onReset: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  onConfirm?: () => boolean | Promise<boolean>;
}) {
  const intl = useIntl();
  const { height: windowHeight } = useWindowDimensions();
  const footer = (
    <DialogFooter
      showFooter
      showConfirmButton
      showCancelButton={false}
      footerProps={{
        testID: `${testIDPrefix}-footer`,
        justifyContent: 'flex-end',
        flexShrink: 0,
        pt: '$3',
        pb: '$3',
        borderTopWidth: '$px',
        borderTopColor: '$borderSubdued',
      }}
      onConfirm={async ({ preventClose }) => {
        if ((await onConfirm?.()) === false) {
          preventClose();
        }
      }}
      leadingContent={
        <Button
          testID={`${testIDPrefix}-mock-reset`}
          variant="secondary"
          $md={{ size: 'large' }}
          disabled={isSubmitting}
          onPress={onReset}
        >
          {intl.formatMessage({ id: ETranslations.global_reset })}
        </Button>
      }
      confirmButtonProps={{
        testID: `${testIDPrefix}-mock-confirm`,
        loading: isSubmitting,
        disabled: isSubmitting,
        flexGrow: 0,
        flexBasis: 'auto',
      }}
    />
  );

  return (
    <DialogContainer
      ref={dialogRef}
      title={title}
      testID={testID}
      floatingPanelProps={{ width: '$160', maxWidth: '$160' }}
      contentContainerProps={{ px: '$0', pb: '$0' }}
      showExitButton={!isSubmitting}
      showFooter={false}
      onOpenAutoFocus={(event) => {
        const container = event.currentTarget;
        if (
          typeof HTMLElement !== 'undefined' &&
          container instanceof HTMLElement
        ) {
          event.preventDefault();
          container.tabIndex = -1;
          container.focus({ preventScroll: true });
        }
      }}
      onHeaderCloseButtonPress={onClose}
      onClose={() => Promise.resolve()}
      onCancel={onCancel}
      renderContent={
        <YStack
          testID={`${testIDPrefix}-content-container`}
          height={Math.min(477, Math.max(windowHeight - 107, 0))}
          minHeight={0}
        >
          {children(footer)}
        </YStack>
      }
    />
  );
}
