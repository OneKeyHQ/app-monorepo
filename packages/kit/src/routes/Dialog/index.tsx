import React, { FC } from 'react';

import { Box } from '@onekeyhq/components';
import type { DeleteWalletProp } from '@onekeyhq/kit/src/views/ManagerWallet/DeleteWallet';
import ManagerWalletDeleteDialog from '@onekeyhq/kit/src/views/ManagerWallet/DeleteWallet';

import GlobalDialog, { useDialog } from '../../components/Dialog';

export type GlobalDialogParamsType<T, K> = {
  params: T;
  result: K;
};

// 1. 添加一个新的 dialogId
export enum GlobalDialogIds {
  SimpleDialog = 'SimpleDialog',
  DeleteWalletDialog = 'DeleteWalletDialog',
}

// 2. 为新的 dialog 添加类型约束
export type GlobalDialogParams = {
  // 第一范型是 request，第二范型是 response
  [GlobalDialogIds.SimpleDialog]: GlobalDialogParamsType<string, string>;
  [GlobalDialogIds.DeleteWalletDialog]: GlobalDialogParamsType<
    DeleteWalletProp,
    boolean
  >;
};

const SimpleDialog: FC = () => {
  const dialogId = GlobalDialogIds.SimpleDialog;
  // 3. 为新的 dialog 添加 hook，并且添加类型约束
  const { hide, resolve } =
    useDialog<GlobalDialogParams[GlobalDialogIds.SimpleDialog]>(dialogId);

  return (
    <GlobalDialog
      dialogId={dialogId}
      onClose={() => {
        hide();
      }}
      contentProps={{
        iconType: 'info',
        content: 'This is a simple dialog',
      }}
      footerButtonProps={{
        onPrimaryActionPress: () => {
          // 处理返回值，也可以不处理。
          resolve(true);
          hide();
        },
      }}
    />
  );
};

const DialogProvider = () => (
  <Box>
    <SimpleDialog />
    <ManagerWalletDeleteDialog />
  </Box>
);

export default DialogProvider;
