import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { CardErrors } from '@onekeyhq/app/src/hardware/OnekeyLite/types';
import { Dialog } from '@onekeyhq/components';
import type { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';

export interface ErrorDialogViewProps {
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
  // eslint-disable-next-line react/no-unused-prop-types
  onContinue?: () => void;
  onIntoNfcSetting?: () => void;
}

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
        visible={code === CardErrors.NotExistsNFC}
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
            setTimeout(() => onExit?.(), 500);
          },
        }}
      />

      {/* 没有 NFC 权限 */}
      <Dialog
        visible={
          code === CardErrors.NotEnableNFC ||
          code === CardErrors.NotNFCPermission
        }
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'info',
          title: intl.formatMessage({
            id: 'modal__turn_on_nfc_and_let_onekey_connect_your_hardware_devices',
          }),
          content: intl.formatMessage({
            id: 'modal__onekey_wants_to_use_nfc_desc',
          }),
        }}
        footerButtonProps={{
          hideSecondaryAction: true,
          primaryActionProps: {
            type: 'destructive',
            children: intl.formatMessage({ id: 'action__i_got_it' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            setTimeout(() => onIntoNfcSetting?.(), 500);
          },
        }}
      />

      {/* 连接失败（可能是连接问题） */}
      <Dialog
        visible={
          code === CardErrors.InitChannel ||
          code === CardErrors.ConnectionFail ||
          code === CardErrors.ExecFailure
        }
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
            setTimeout(() => onRetryConnect?.(), 500);
          },
          onSecondaryActionPress: () => onExit?.(),
        }}
      />

      {/* 操作中断（可能是连接问题） */}
      <Dialog
        visible={code === CardErrors.InterruptError}
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
        visible={code === CardErrors.NotInitializedError}
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
            children: intl.formatMessage({ id: 'action__i_got_it' }),
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
        visible={code === CardErrors.InitializedError}
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
            children: intl.formatMessage({ id: 'action__overwrite' }),
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
          code === CardErrors.PasswordWrong ||
          code === CardErrors.InputPasswordEmpty ||
          code === CardErrors.NotSetPassword ||
          code === CardErrors.InitPasswordError
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
            children: intl.formatMessage({ id: 'action__i_got_it' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            setTimeout(() => onRetry?.(), 500);
          },
          onSecondaryActionPress: () => onExit?.(),
        }}
      />

      {/* Card 已被锁定，需要手动 Reset */}
      <Dialog
        visible={code === CardErrors.CardLock}
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'danger',
          title: '卡片已经锁定',
          content: '卡片已经锁定，需要手动重置。',
        }}
        footerButtonProps={{
          primaryActionProps: {
            type: 'destructive',
            children: intl.formatMessage({ id: 'action__i_got_it' }),
          },
          onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
            onClose?.();
            onExit?.();
          },
          onSecondaryActionPress: () => onExit?.(),
        }}
      />

      {/* Card Pin 码输入失败次数太多已经重置 */}
      <Dialog
        visible={code === CardErrors.UpperErrorAutoReset}
        canceledOnTouchOutside={false}
        onClose={() => onDialogClose?.()}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'modal__onekey_lite_has_been_reset',
          }),
          content: intl.formatMessage({
            id: 'modal__onekey_lite_has_been_reset_desc',
          }),
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
          onSecondaryActionPress: () => onExit?.(),
        }}
      />

      {/* 用户主动取消 */}
      {code === CardErrors.UserCancel && onExit?.()}
    </>
  );
};

export default ErrorDialog;
