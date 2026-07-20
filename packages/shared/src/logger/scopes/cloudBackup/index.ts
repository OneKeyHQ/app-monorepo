import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { CloudBackupAvailabilityScene } from './scenes/availability';
import { GetDataForBackupScene } from './scenes/getDataForBackupScene';

export class CloudBackupScope extends BaseScope {
  protected override scopeName = EScopeName.cloudBackup;

  availability = this.createScene('availability', CloudBackupAvailabilityScene);

  getDataForBackupScene = this.createScene(
    'getDataForBackupScene',
    GetDataForBackupScene,
  );
}
