import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IIconButtonProps } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export interface IDownloadButtonProps {
  size?: IIconButtonProps['size'];
  iconSize?: IIconButtonProps['iconSize'];
  downloadUrl?: string;
}

export function DownloadButton({
  size,
  iconSize,
  downloadUrl = DOWNLOAD_URL,
}: IDownloadButtonProps) {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    openUrlExternal(downloadUrl);
  }, [downloadUrl]);

  return (
    <HeaderIconButton
      size={size}
      title={intl.formatMessage({ id: ETranslations.global_download })}
      icon="DownloadOutline"
      iconSize={iconSize}
      onPress={handlePress}
    />
  );
}
