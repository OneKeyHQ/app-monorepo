import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { NewCloudBackupHome } from './new';
import { OldCloudBackupHome } from './old';

export default function Home() {
  const [devSettings] = useDevSettingsPersistAtom();

  const isShowCloudBackupSunsettingAlert =
    devSettings.settings?.showCloudBackupSunsettingAlert;

  if (isShowCloudBackupSunsettingAlert) {
    return <NewCloudBackupHome />;
  }

  return <OldCloudBackupHome />;
}
