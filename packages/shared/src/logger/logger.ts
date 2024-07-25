import { AccountScope } from './scopes/account';
import { AddressInputScope } from './scopes/addressInput';
import { AppScope } from './scopes/app';
import { DemoScope } from './scopes/demo';
import { DiscoveryScope } from './scopes/discovery';
import { SettingScope } from './scopes/setting';
import { SignatureRecordScope } from './scopes/signatureRecord';
import { StakingScope } from './scopes/staking';
import { SwapScope } from './scopes/swap';
import { TokenScope } from './scopes/token';
import { UpdateScope } from './scopes/update';

class Logger {
  account = new AccountScope();

  app = new AppScope();

  demo = new DemoScope();

  setting = new SettingScope();

  addressInput = new AddressInputScope();

  signatureRecord = new SignatureRecordScope();

  update = new UpdateScope();

  discovery = new DiscoveryScope();

  token = new TokenScope();

  swap = new SwapScope();

  staking = new StakingScope();
}

export const defaultLogger = new Logger();
