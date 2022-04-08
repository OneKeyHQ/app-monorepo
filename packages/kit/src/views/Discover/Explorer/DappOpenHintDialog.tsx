import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

import type { DAppItemType } from '../type';

export type DappOpenHintDialogProps = {
  payload: DAppItemType | undefined;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onAgree: (payload: DAppItemType | undefined) => void;
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
          onAgree?.(payload);
          onVisibleChange(false);
        },
      }}
    />
  );
};

export default DappOpenHintDialog;
