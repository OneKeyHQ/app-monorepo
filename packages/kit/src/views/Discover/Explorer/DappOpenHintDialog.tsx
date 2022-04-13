import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

export type DappOpenHintDialogProps = {
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onConfirm: () => void;
};

const DappOpenHintDialog: FC<DappOpenHintDialogProps> = ({
  visible,
  onVisibilityChange,
  onConfirm,
}) => {
  const intl = useIntl();

  return (
    <Dialog
      hasFormInsideDialog
      visible={visible}
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
      }}
    />
  );
};

export default DappOpenHintDialog;
