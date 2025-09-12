import { useIntl } from 'react-intl';

import { Dialog, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

/*
- 本地密码未设置（本地修改密码过程中异常退出）
- 服务器密码未设置（被其他端重置）
- 本地和服务器密码不一致（被其他端修改密码）
*/

export function PrimeMasterPasswordInvalidDialog() {
  const intl = useIntl();
  return (
    <Stack>
      <Dialog.Title>
        {intl.formatMessage({
          id: ETranslations.prime_sync_password_invalid_title,
        })}
      </Dialog.Title>

      <Stack pt="$4">
        <SizableText>
          {intl.formatMessage({
            id: ETranslations.prime_sync_password_invalid_description,
          })}
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
