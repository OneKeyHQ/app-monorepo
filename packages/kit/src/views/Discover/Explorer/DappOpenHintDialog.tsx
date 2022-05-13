import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, DialogManager } from '@onekeyhq/components';

export type DappOpenHintDialogProps = {
  onVisibilityChange: (visible: boolean) => void;
  onConfirm: () => void;
};

const DappOpenHintDialog: FC<DappOpenHintDialogProps> = ({
  onVisibilityChange,
  onConfirm,
}) => {
  const intl = useIntl();

  return (
    <Dialog
      visible
      hasFormInsideDialog
      onClose={() => {
        onVisibilityChange?.(false);
      }}
      contentProps={{
        iconType: 'info',
        title: intl.formatMessage({
          id: 'modal__you_are_visiting_third_party_dapps',
        }),
        content: intl.formatMessage({
          id: 'modal__you_are_visiting_third_party_dapps_desc',
        }),
      }}
      footerButtonProps={{
        primaryActionTranslationId: 'action__i_got_it',
        onPrimaryActionPress: () => {
          onConfirm?.();
        },
        onSecondaryActionPress: () => {
          DialogManager.hide();
        },
      }}
    />
  );
};

export default DappOpenHintDialog;
