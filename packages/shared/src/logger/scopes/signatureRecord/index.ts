import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { NormalScene } from './scenes/normal';

export class SignatureRecordScope extends BaseScope {
  protected override scopeName = EScopeName.signatureRecord;

  normal = this.createScene('normal', NormalScene);
}
