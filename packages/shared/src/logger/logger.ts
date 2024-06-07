import { AddressInputScope } from './scopes/AddressInput';
import { AppScope } from './scopes/app';
import { DemoScope } from './scopes/demo';
import { SettingScope } from './scopes/setting';
import { SignatureRecordScope } from './scopes/signatureRecord';

class Logger {
  app = new AppScope();

  demo = new DemoScope();

  setting = new SettingScope();

  addressInput = new AddressInputScope();

  signatureRecord = new SignatureRecordScope();
}

export const defaultLogger = new Logger();
