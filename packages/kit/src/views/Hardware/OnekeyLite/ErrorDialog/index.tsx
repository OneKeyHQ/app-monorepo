import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';

export type ErrorDialogViewProps = {
  code: number;
  /**
   * 其他附带数据
   */
  pinRetryCount?: string;
  /**
   * 关闭弹窗的响应
   */
  onDialogClose: () => void;
  /**
   * 整个流程重新尝试
   */
  onRetry?: () => void;
  /**
   * 重新尝试连接
   */
  onRetryConnect?: () => void;
  /**
   * 退出流程
   */
  onExit?: () => void;
  onContinue?: () => void;
  onIntoNfcSetting?: () => void;
};

const ErrorDialog: FC<ErrorDialogViewProps> = ({
  code,
  pinRetryCount,
  onRetry,
  onRetryConnect,
  onExit,
  onDialogClose,
  onIntoNfcSetting,
}) => {
  const intl = useIntl();

  return (
    <>
      {/* 设备没有 NFC */}
      <Dialog
        visible={code === 1001}
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'info',
          title: intl.formatMessage({ id: 'modal__unable_to_connect' }),
          content: intl.formatMessage({ id: 'modal__unable_to_connect_desc' }),
        }}
        footerButtonProps={{
          hideSecondaryAction: true,
          primaryActionProps: {
            type: 'destructive',
            children: intl.formatMessage({ id: 'action__i_got_it' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            onExit?.();
          },
        }}
      />

      {/* 没有 NFC 权限 */}
      <Dialog
        visible={code === 1002 || code === 1003}
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'info',
          title: intl.formatMessage({
            id: 'modal__turn_on_nfc_and_let_onekey_connect_your_hardware_devices',
          }),
          content: intl.formatMessage({ id: 'modal__unable_to_connect_desc' }),
        }}
        footerButtonProps={{
          hideSecondaryAction: true,
          primaryActionProps: {
            type: 'destructive',
            children: intl.formatMessage({ id: 'action__i_got_it' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            onIntoNfcSetting?.();
          },
        }}
      />

      {/* 连接失败（可能是连接问题） */}
      <Dialog
        visible={code === 1000 || code === 2001 || code === 4000}
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'info',
          title: intl.formatMessage({ id: 'modal__failed_to_connect' }),
          content: intl.formatMessage({ id: 'modal__failed_to_connect_desc' }),
        }}
        footerButtonProps={{
          primaryActionProps: {
            type: 'destructive',
            children: intl.formatMessage({ id: 'action__retry' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            onRetryConnect?.();
          },
          onSecondaryActionPress: () => onExit?.(),
        }}
      />

      {/* 操作中断（可能是连接问题） */}
      <Dialog
        visible={code === 2002}
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'info',
          title: intl.formatMessage({ id: 'modal__failed_to_connect' }),
          content: intl.formatMessage({ id: 'modal__failed_to_connect_desc' }),
        }}
        footerButtonProps={{
          primaryActionProps: {
            type: 'destructive',
            children: intl.formatMessage({ id: 'action__retry' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            onRetryConnect?.();
          },
          onSecondaryActionPress: () => onExit?.(),
        }}
      />

      {/* 没有备份过内容 */}
      <Dialog
        visible={code === 4002}
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'modal__this_device_has_no_backup_inbside',
          }),
          content: intl.formatMessage({
            id: 'modal__this_device_has_no_backup_inbside_desc',
          }),
        }}
        footerButtonProps={{
          primaryActionProps: {
            type: 'destructive',
            children: intl.formatMessage({ id: 'action__retry' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            onExit?.();
          },
          onSecondaryActionPress: () => onExit?.(),
        }}
      />

      {/* 已经备份过内容 */}
      <Dialog
        visible={code === 4001}
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'modal__this_device_contains_backup',
          }),
          content: intl.formatMessage({
            id: 'modal__this_device_contains_backup_desc',
          }),
        }}
        footerButtonProps={{
          primaryActionProps: {
            type: 'destructive',
            children: intl.formatMessage({ id: 'action__retry' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            onRetryConnect?.();
          },
          onSecondaryActionPress: () => onExit?.(),
        }}
      />

      {/* 密码错误 */}
      <Dialog
        visible={
          code === 3001 || code === 3002 || code === 3003 || code === 3004
        }
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'transaction__failed',
          }),
          content: intl.formatMessage(
            {
              id: 'content__pin_error_the_data_of_this_device_will_be_erased_after_str_more_wrong_tries',
            },
            { count: pinRetryCount },
          ),
        }}
        footerButtonProps={{
          primaryActionProps: {
            type: 'destructive',
            children: intl.formatMessage({ id: 'action__retry' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            onExit?.();
            onRetry?.();
          },
          onSecondaryActionPress: () => onExit?.(),
        }}
      />
    </>
  );
};

export default ErrorDialog;
