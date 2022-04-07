import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

export type DappOpenHintDialogProps = {
  payload: string | undefined;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onAgree: (payload: string | undefined) => void;
};

const DappOpenHintDialog: FC<DappOpenHintDialogProps> = ({
  visible,
  onVisibleChange,
  payload,
  onAgree,
}) => {
  const intl = useIntl();

  return (
    <Dialog
      hasFormInsideDialog
      visible={visible}
      onClose={() => {
        onVisibleChange(false);
      }}
      onVisibleChange={onVisibleChange}
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
          onVisibleChange(false);
          onAgree?.(payload);
        },
      }}
    />
  );
};

export default DappOpenHintDialog;
