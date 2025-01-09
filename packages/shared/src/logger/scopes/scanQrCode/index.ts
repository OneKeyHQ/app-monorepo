import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { ParseQrCodeScene } from './scenes/parseQrCode';
import { ReadQrCodeScene } from './scenes/readQrCode';

export class ScanQrCodeScope extends BaseScope {
  protected override scopeName = EScopeName.scanQrCode;

  readQrCode = this.createScene('readQrCode', ReadQrCodeScene);

  parseQrCode = this.createScene('parseQrCode', ParseQrCodeScene);
}
