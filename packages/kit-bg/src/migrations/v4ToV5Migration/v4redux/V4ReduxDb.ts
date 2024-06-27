import { isPlainObject, isString } from 'lodash';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import type {
  IV4ReduxCloudBackupState,
  IV4ReduxContactsState,
  IV4ReduxDiscoverState,
  IV4ReduxSettingsState,
} from '../v4types/v4typesRedux';

type IV4SimpleDbRawData = {
  settings: string;
  contacts: string;
  discover: string;
  cloudBackup: string;
};

export type IV4SimpleDbData = {
  settings: IV4ReduxSettingsState | undefined;
  contacts: IV4ReduxContactsState | undefined;
  discover: IV4ReduxDiscoverState | undefined;
  cloudBackup: IV4ReduxCloudBackupState | undefined;
};

export class V4ReduxDb {
  reduxData: Promise<IV4SimpleDbData | undefined>;

  constructor() {
    // eslint-disable-next-line no-async-promise-executor
    this.reduxData = new Promise(async (resolve) => {
      try {
        const data = await appStorage.getItem('persist:ONEKEY_WALLET');
        if (!data) {
          resolve(undefined);
          return;
        }
        if (isPlainObject(data)) {
          resolve(this.parseReduxData(data as unknown as IV4SimpleDbRawData));
          return;
        }
        if (isString(data)) {
          resolve(this.parseReduxData(JSON.parse(data)));
          return;
        }
        resolve(undefined);
      } catch (error) {
        resolve(undefined);
      } finally {
        resolve(undefined);
      }
      resolve(undefined);
    });
  }

  parseReduxField(value: string) {
    if (isPlainObject(value)) {
      return value;
    }
    if (isString(value)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return JSON.parse(value);
      } catch (error) {
        //
      }
    }
    return undefined;
  }

  parseReduxData(data: IV4SimpleDbRawData): IV4SimpleDbData {
    return {
      settings: this.parseReduxField(data.settings),
      contacts: this.parseReduxField(data.contacts),
      discover: this.parseReduxField(data.discover),
      cloudBackup: this.parseReduxField(data.cloudBackup),
    };
  }
}
