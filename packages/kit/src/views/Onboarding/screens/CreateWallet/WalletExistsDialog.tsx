import { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Icon } from '@onekeyhq/components';

export type WalletExistsDialogDialogProps = {
  onDone: () => void;
  onClose?: () => void;
};

const WalletExistsDialog: FC<WalletExistsDialogDialogProps> = ({
  onDone,
  onClose,
}) => {
  const intl = useIntl();

  return (
    <>
      <Dialog
        visible
        hasFormInsideDialog
        onClose={() => {
          onClose?.();
        }}
        contentProps={{
          icon: <Icon name="ExclamationOutline" size={48} />,
          title: '钱包已存在',
          content: '钱包已存在，是否切换到当前钱包',
        }}
        footerButtonProps={{
          primaryActionTranslationId: 'action__switch',
          // eslint-disable-next-line @typescript-eslint/no-shadow
          onPrimaryActionPress: ({ onClose }) => {
            onDone();
            onClose?.();
          },
        }}
      />
    </>
  );
};

export default WalletExistsDialog;
