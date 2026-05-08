import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IMarketPresetDirectionDbSettings {
  slippage: {
    key: string;
    value?: number;
  };
  priorityFee: {
    type: string;
    customValue?: string;
  };
}

export interface IMarketPresetNetworkDbSettings {
  selectedPresetKey?: string;
  presets?: Record<
    string,
    Partial<Record<'buy' | 'sell', IMarketPresetDirectionDbSettings>>
  >;
}

export interface IMarketPresetSettingsDb {
  settings: Record<string, IMarketPresetNetworkDbSettings>;
}

export class SimpleDbEntityMarketPresetSettings extends SimpleDbEntityBase<IMarketPresetSettingsDb> {
  entityName = 'marketPresetSettings';

  override enableCache = false;

  @backgroundMethod()
  async getSettings({ networkId }: { networkId: string }) {
    const rawData = await this.getRawData();
    return rawData?.settings?.[networkId];
  }

  @backgroundMethod()
  async setSelectedPresetKey({
    networkId,
    presetKey,
  }: {
    networkId: string;
    presetKey: string;
  }) {
    await this.setRawData((rawData) => {
      const networkSettings = rawData?.settings?.[networkId] ?? {};
      return {
        settings: {
          ...rawData?.settings,
          [networkId]: {
            ...networkSettings,
            selectedPresetKey: presetKey,
          },
        },
      };
    });
  }

  @backgroundMethod()
  async setPresetDirectionSettings({
    networkId,
    presetKey,
    tradeSide,
    settings,
  }: {
    networkId: string;
    presetKey: string;
    tradeSide: 'buy' | 'sell';
    settings: IMarketPresetDirectionDbSettings;
  }) {
    await this.setRawData((rawData) => {
      const networkSettings = rawData?.settings?.[networkId] ?? {};
      const presetSettings = networkSettings.presets?.[presetKey] ?? {};
      return {
        settings: {
          ...rawData?.settings,
          [networkId]: {
            ...networkSettings,
            presets: {
              ...networkSettings.presets,
              [presetKey]: {
                ...presetSettings,
                [tradeSide]: settings,
              },
            },
          },
        },
      };
    });
  }

  @backgroundMethod()
  async resetPresetDirectionSettings({
    networkId,
    presetKey,
    tradeSide,
  }: {
    networkId: string;
    presetKey: string;
    tradeSide: 'buy' | 'sell';
  }) {
    await this.setRawData((rawData) => {
      const networkSettings = rawData?.settings?.[networkId] ?? {};
      const presetSettings = {
        ...networkSettings.presets?.[presetKey],
      };
      delete presetSettings[tradeSide];

      return {
        settings: {
          ...rawData?.settings,
          [networkId]: {
            ...networkSettings,
            presets: {
              ...networkSettings.presets,
              [presetKey]: presetSettings,
            },
          },
        },
      };
    });
  }
}
