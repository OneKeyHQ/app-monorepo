import { Divider } from '@onekeyhq/components';
import { useAutoUpdate, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import appUpdates from '../../../utils/updates/AppUpdates';

import type { IBaseMenuOptions } from '../BaseMenu';
import type { MessageDescriptor } from 'react-intl';

const useUpdateItem: () => IBaseMenuOptions | null = () => {
  const { state, progress, latest } = useAutoUpdate();
  const { autoDownload = true } = useSettings().updateSetting ?? {};

  let formText: null | MessageDescriptor['id'] = null;
  let intlValues: Record<number, string> | undefined;
  const disabled = state === 'downloading';
  if (state === 'available') {
    formText = 'action__update_available';
  } else if (state === 'ready') {
    formText = 'action__restart_n_update';
  } else if (!autoDownload && state === 'downloading') {
    formText = 'form__update_downloading';
    intlValues = {
      0: `${Math.floor(progress.percent)}%`,
    };
  }

  if (!formText) {
    return null;
  }

  return [
    () => <Divider />,
    {
      id: formText,
      intlValues,
      isDisabled: disabled,
      variant: 'highlight',
      icon: 'UploadOutline',
      onPress: () => {
        if (state === 'ready') {
          window.desktopApi.installUpdate();
        } else if (!platformEnv.supportAutoUpdate) {
          if (latest !== undefined && 'package' in latest) {
            appUpdates.openAppUpdate(latest);
          }
        } else {
          window.desktopApi.downloadUpdate();
        }
      },
      closeOnSelect: false,
    },
  ];
};

export default useUpdateItem;
