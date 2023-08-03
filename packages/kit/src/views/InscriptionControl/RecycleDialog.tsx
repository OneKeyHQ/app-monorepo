import { Dialog } from '@onekeyhq/components';
import { useIntl } from 'react-intl';

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
        primaryActionTranslationId: 'action__delete',
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
          id: 'form__reset_app',
          defaultMessage: '是否要回收所选铭文',
        }),
        content: intl.formatMessage(
          {
            id: 'modal__reset_app_desc',
          },
          { 0: 'RESET' },
        ),
      }}
    />
  );
}

export { RecycleDialog };
