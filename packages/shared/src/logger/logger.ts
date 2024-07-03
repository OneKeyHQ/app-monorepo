import { AddressInputScope } from './scopes/AddressInput';
import { AppScope } from './scopes/app';
import { DemoScope } from './scopes/demo';
import { SettingScope } from './scopes/setting';
import { SignatureRecordScope } from './scopes/signatureRecord';
import { UpdateScope } from './scopes/update';

class Logger {
  app = new AppScope();

  demo = new DemoScope();

  setting = new SettingScope();

  addressInput = new AddressInputScope();

  signatureRecord = new SignatureRecordScope();

  update = new UpdateScope();
}

export const defaultLogger = new Logger();
