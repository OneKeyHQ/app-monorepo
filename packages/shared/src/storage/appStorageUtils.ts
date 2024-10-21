import platformEnv from '../platformEnv';

import appStorage from './appStorage';

import type WebStorage from './WebStorage';

let _canSaveAsObject: boolean | null = null;

function canSaveAsObject(): boolean {
  if (_canSaveAsObject === null) {
    _canSaveAsObject = false;
    if (platformEnv.isRuntimeBrowser) {
      const isIndexedDB: boolean = (
        appStorage as unknown as WebStorage
      )?.isIndexedDB();
      if (isIndexedDB) {
        _canSaveAsObject = true;
      }
    }
  }
  return _canSaveAsObject;
}

export default {
  canSaveAsObject,
};
