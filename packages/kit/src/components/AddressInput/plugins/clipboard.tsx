import { type FC, useCallback } from 'react';

import { IconButton, useClipboard } from '@onekeyhq/components';

import type { IAddressPluginProps } from '../types';
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export const ClipboardPlugin: FC<IAddressPluginProps> = ({
  onChange,
  testID,
}) => {
  const { getClipboard } = useClipboard();
  const intl = useIntl();
  const onPress = useCallback(async () => {
    const text = await getClipboard();
    onChange?.(text);
  }, [onChange, getClipboard]);
  return (
    <IconButton
      title={intl.formatMessage({ id: ETranslations.send_to_paste_tooltip })}
      variant="tertiary"
      icon="ClipboardOutline"
      onPress={onPress}
      testID={testID}
    />
  );
};
