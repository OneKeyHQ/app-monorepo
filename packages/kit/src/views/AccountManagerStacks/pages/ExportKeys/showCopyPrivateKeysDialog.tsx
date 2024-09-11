import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, Stack, useClipboard } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function CopyPrivateKeysDialog({
  defaultValue,
  rawKeyContent,
  showCheckBox,
}: {
  defaultValue: boolean;
  rawKeyContent: string;
  showCheckBox: boolean;
}) {
  const intl = useIntl();
  const [value, changeValue] = useState(defaultValue);
  const handleChange = useCallback((checked: ICheckedState) => {
    changeValue(!!checked);
  }, []);
  const clipboard = useClipboard();

  return (
    <>
      {showCheckBox ? (
        <Stack pr="$1">
          <Checkbox
            testID="private-key-copy-check"
            value={value}
            onChange={handleChange}
            label={intl.formatMessage({
              id: ETranslations.global_private_key_copy_check,
            })}
          />
        </Stack>
      ) : null}
      <Dialog.Footer
        onConfirmText={intl.formatMessage({ id: ETranslations.global_copy })}
        confirmButtonProps={{
          testID: 'private-key-copy-confirm',
          disabled: showCheckBox && !value,
          //   variant: 'destructive',
        }}
        onConfirm={async () => {
          //
          clipboard.copyText(rawKeyContent);
        }}
      />
    </>
  );
}

export function showCopyPrivateKeysDialog({
  title,
  description,
  defaultChecked,
  rawKeyContent,
  showCheckBox,
}: {
  defaultChecked: boolean;
  title: string;
  description: string;
  rawKeyContent: string;
  showCheckBox: boolean;
}) {
  return Dialog.show({
    icon: 'ErrorOutline',
    tone: 'destructive',
    title,
    description,
    renderContent: (
      <CopyPrivateKeysDialog
        rawKeyContent={rawKeyContent}
        defaultValue={defaultChecked}
        showCheckBox={showCheckBox}
      />
    ),
  });
}
