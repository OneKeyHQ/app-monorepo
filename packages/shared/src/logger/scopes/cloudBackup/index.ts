import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { GetDataForBackupScene } from './scenes/getDataForBackupScene';

export class CloudBackupScope extends BaseScope {
  protected override scopeName = EScopeName.cloudBackup;

  getDataForBackupScene = this.createScene(
    'getDataForBackupScene',
    GetDataForBackupScene,
  );
}
