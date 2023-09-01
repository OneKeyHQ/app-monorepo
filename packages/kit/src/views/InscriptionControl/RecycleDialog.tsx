import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

type Props = {
  amount: string;
  onConfirm: () => void;
  onClose?: () => void;
};

function RecycleDialog({ onConfirm, onClose, amount }: Props) {
  const intl = useIntl();

  return (
    <Dialog
      visible
      footerButtonProps={{
        primaryActionTranslationId: 'action__deoccupy',
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
        iconName: 'RestoreMini',
        iconType: 'danger',
        title: intl.formatMessage({
          id: 'title__release_occupied_balance',
        }),
        content: intl.formatMessage(
          {
            id: 'content__release_occupied_balance',
          },
          {
            0: amount,
          },
        ),
      }}
    />
  );
}

export { RecycleDialog };
