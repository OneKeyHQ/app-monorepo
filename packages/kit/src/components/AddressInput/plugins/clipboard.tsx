import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Toast, useClipboard } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

import type { IAddressPluginProps } from '../types';

export const ClipboardPlugin: FC<IAddressPluginProps> = ({
  onChange,
  onInputTypeChange,
  testID,
  disabled,
}) => {
  const { getClipboard, supportPaste } = useClipboard();
  const intl = useIntl();
  const onPress = useCallback(async () => {
    const text = await getClipboard();
    onChange?.(text);
    onInputTypeChange?.(EInputAddressChangeType.Paste);

    if (text?.length) {
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_address_pasted_text,
        }),
      });
    }
  }, [getClipboard, intl, onChange, onInputTypeChange]);
  return !supportPaste ? null : (
    <IconButton
      title={intl.formatMessage({ id: ETranslations.send_to_paste_tooltip })}
      variant="tertiary"
      icon="ClipboardOutline"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      testID={testID}
    />
  );
};
