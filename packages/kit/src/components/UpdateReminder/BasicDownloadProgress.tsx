import { useIntl } from 'react-intl';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getAppUpdateProgressScope } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useDownloadProgress } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

export function DownloadProgress() {
  const intl = useIntl();
  const [info] = useAppUpdatePersistAtom();
  const percent = useDownloadProgress(getAppUpdateProgressScope(info));
  return intl.formatMessage(
    { id: ETranslations.update_downloading_package },
    { progress: percent },
  );
}
