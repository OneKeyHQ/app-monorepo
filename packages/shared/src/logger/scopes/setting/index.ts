import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { DeviceScene } from './scenes/device';
import { PageScene } from './scenes/page';

export class SettingScope extends BaseScope {
  protected override scopeName = EScopeName.setting;

  device = this.createScene('device', DeviceScene);

  page = this.createScene('page', PageScene);
}

export type {
  ISettingCategoryOpenedParams,
  ISettingCategoryOpenedSource,
  ISettingItemClickedParams,
  ISettingsAnalyticsLayout,
  ISettingsEntrySurface,
  ISettingsOpenedParams,
  ISettingsSearchedParams,
  ISettingValueChangedParams,
} from './types';
