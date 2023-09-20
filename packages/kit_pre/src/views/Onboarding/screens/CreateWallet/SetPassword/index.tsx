import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

export function RecoveryPhraseDialog({
  onNext,
  onClose,
}: {
  onNext?: () => void;
  onClose?: () => void;
}) {
  const intl = useIntl();

  return (
    <Dialog
      visible
      contentProps={{
        iconType: 'info',
        title: intl.formatMessage({
          id: 'modal__youre_importing_a_hot_wallet',
        }),
        content: intl.formatMessage({
          id: 'modal__youre_importing_a_hot_wallet_desc',
        }),
      }}
      footerButtonProps={{
        secondaryActionProps: {
          size: 'xl',
        },
        primaryActionProps: {
          size: 'xl',
          type: 'primary',
          children: intl.formatMessage({ id: 'action__confirm' }),
        },
        onPrimaryActionPress: () => {
          onClose?.();
          onNext?.();
        },
        onSecondaryActionPress() {
          onClose?.();
        },
      }}
    />
  );
}
