import { memo } from 'react';

import { Dialog } from '@onekeyhq/components';

import PasswordVerify from './PasswordVerify';

interface IPasswordDialogProps {
  open: boolean;
  onClose?: () => void;
}

const PasswordDialog = ({ open, onClose }: IPasswordDialogProps) => (
  <Dialog
    backdrop
    open={open}
    title="ConfirmPassword"
    renderFooter={null}
    renderContent={
      <PasswordVerify
        onVerifyRes={(password) => {
          console.log('passwordres', password);
          // todo 关闭弹窗 传递密码验证结果
        }}
      />
    }
    onClose={onClose}
  />
);
export default memo(PasswordDialog);
