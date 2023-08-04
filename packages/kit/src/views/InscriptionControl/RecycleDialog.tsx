import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

type Props = {
  onConfirm: () => void;
  onClose?: () => void;
};

function RecycleDialog({ onConfirm, onClose }: Props) {
  const intl = useIntl();

  return (
    <Dialog
      visible
      footerButtonProps={{
        primaryActionTranslationId: 'action__destroy',
        primaryActionProps: {
          type: 'destructive',
        },
        onPrimaryActionPress: () => {
          onConfirm();
          onClose?.();
        },
        onSecondaryActionPress: onClose,
      }}
      contentProps={{
        iconName: 'FireSolid',
        iconType: 'danger',
        title: intl.formatMessage({
          id: 'title__destroy_selected_inscription',
        }),
        content: intl.formatMessage({
          id: 'dialog__destroy_selected_inscription',
        }),
      }}
    />
  );
}

export { RecycleDialog };
