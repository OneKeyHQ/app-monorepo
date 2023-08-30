import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

type Props = {
  onConfirm: (onClose?: () => void) => void;
  onClose?: () => void;
};

function UnListBTCAssetUnexpectedDialog({ onConfirm, onClose }: Props) {
  const intl = useIntl();

  return (
    <Dialog
      visible
      footerButtonProps={{
        primaryActionTranslationId: 'action__send',
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
        iconName: 'PaperAirplaneSolid',
        iconType: 'danger',
        title: intl.formatMessage({
          id: 'title__release_occupied_balance',
        }),
        content: intl.formatMessage({
          id: 'content__release_occupied_balance',
        }),
      }}
    />
  );
}

function UnListBTCAssetExplicitDialog({ onConfirm, onClose }: Props) {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog
      visible
      footerButtonProps={{
        primaryActionTranslationId: 'action__send',
        primaryActionProps: {
          type: 'primary',
          isLoading,
        },
        onPrimaryActionPress: () => {
          setIsLoading(true);
          onConfirm(onClose);
        },
        onSecondaryActionPress: onClose,
      }}
      contentProps={{
        iconName: 'MinusCircleSolid',
        iconType: 'success',
        title: intl.formatMessage({
          id: 'title__release_occupied_balance',
        }),
        content: intl.formatMessage({
          id: 'content__release_occupied_balance',
        }),
      }}
    />
  );
}

export { UnListBTCAssetUnexpectedDialog, UnListBTCAssetExplicitDialog };
