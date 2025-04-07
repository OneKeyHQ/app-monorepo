import { Dialog, SizableText, Stack } from '@onekeyhq/components';

/*
- 本地密码未设置（本地修改密码过程中异常退出）
- 服务器密码未设置（被其他端重置）
- 本地和服务器密码不一致（被其他端修改密码）
*/

export function PrimeMasterPasswordInvalidDialog() {
  return (
    <Stack>
      <Dialog.Title>Master Password Invalid</Dialog.Title>

      <Stack pt="$4">
        <SizableText>
          Your master password is reset or changed by another device, please
          re-enable cloud sync and verify your master password again.
        </SizableText>
      </Stack>
      <Dialog.Footer
        showCancelButton
        showConfirmButton={false}
        onCancelText="Got it"
        onCancel={async () => {
          //
        }}
      />
    </Stack>
  );
}
