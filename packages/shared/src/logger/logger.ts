import { AddressInputScope } from './scopes/AddressInput';
import { AppScope } from './scopes/app';
import { DemoScope } from './scopes/demo';
import { SettingScope } from './scopes/setting';

class Logger {
  app = new AppScope();

  demo = new DemoScope();

  setting = new SettingScope();

  addressInput = new AddressInputScope();
}

export const defaultLogger = new Logger();
