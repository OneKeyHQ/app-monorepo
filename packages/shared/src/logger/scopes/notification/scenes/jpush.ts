import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class JPushScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  logSensitiveMessage(a: number, b: number) {
    return [a, b, devOnlyData('this is a sensitive message')];
  }

  logRegisterRidToLocal(rid: string): void {
    this.registerRidToLocal(rid);
  }

  // Intentionally NOT wrapped in devOnlyData: we need the raw registerID in the
  // exportable local log on production/release builds to debug push delivery.
  //
  // The native logger (@onekeyfe/react-native-native-logger) redacts anything
  // matching its sensitive-data regexes before writing to file — a 64-hex push
  // token hits the "private key" pattern and a 20+ char run hits the token
  // pattern, both becoming [REDACTED]. Chunking the id into 8-char groups breaks
  // those contiguous runs so it survives; readers just strip the spaces.
  @LogToLocal({ level: 'info' })
  registerRidToLocal(rid: string): string[] {
    const chunked = rid.replace(/(.{8})/g, '$1 ').trimEnd();
    return [`JPush registerID (strip spaces): ${chunked}`];
  }
}
