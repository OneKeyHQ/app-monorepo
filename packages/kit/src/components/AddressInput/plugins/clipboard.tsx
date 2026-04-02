import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, IconButton, Toast, useClipboard } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

import type { IAddressPluginProps } from '../types';

type IClipboardPluginProps = IAddressPluginProps & {
  display?: 'icon' | 'button';
};

export const ClipboardPlugin: FC<IClipboardPluginProps> = ({
  onChange,
  testID,
  disabled,
  display = 'icon',
}) => {
  const { getClipboard, supportPaste } = useClipboard();
  const intl = useIntl();
  const onPress = useCallback(async () => {
    const text = await getClipboard();
    onChange?.({
      text,
      inputType: EInputAddressChangeType.Paste,
    });

    if (text?.length) {
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_address_pasted_text,
        }),
      });
    }
  }, [getClipboard, intl, onChange]);

  if (!supportPaste) {
    return null;
  }

  if (display === 'button') {
    return (
      <Button
        size="small"
        variant="secondary"
        icon="ClipboardOutline"
        disabled={disabled}
        onPress={disabled ? undefined : onPress}
        testID={testID}
      >
        {intl.formatMessage({ id: ETranslations.send_to_paste_tooltip })}
      </Button>
    );
  }

  return (
    <IconButton
      title={intl.formatMessage({ id: ETranslations.send_to_paste_tooltip })}
      variant="secondary"
      icon="ClipboardOutline"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      testID={testID}
    />
  );
};
