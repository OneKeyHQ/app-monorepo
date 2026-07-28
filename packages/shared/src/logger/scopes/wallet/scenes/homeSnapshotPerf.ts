import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

import type { HomeUiScene } from './homeUi';

type IHomeSnapshotPerfParams = Parameters<
  HomeUiScene['homeDisplaySnapshotCache']
>[0];

export class HomeSnapshotPerfScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public event(params: IHomeSnapshotPerfParams) {
    return params;
  }
}
