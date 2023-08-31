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
          id: 'title__the_inscription_is_listed',
        }),
        content: intl.formatMessage({
          id: 'content__this_will_unlist_previous_order_in_inscription_market_are_you_sure_to_send_the_listed_inscription',
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
        primaryActionTranslationId: 'action__continue',
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
          id: 'title__unlist_the_order',
        }),
        content: intl.formatMessage({
          id: 'content__send_the_listed_inscription_back_to_your_current_account_this_will_unlist_your_previous_order_in_market',
        }),
      }}
    />
  );
}

export { UnListBTCAssetUnexpectedDialog, UnListBTCAssetExplicitDialog };
