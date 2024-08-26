import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

export class SecretPerfScene extends BaseScene {
  // decryptHdCredential
  @LogToConsole()
  public decryptHdCredential() {
    this.resetTimestamp();
    return ['-------', true];
  }

  @LogToConsole()
  public decodePassword() {
    return [true];
  }

  @LogToConsole()
  public decodePasswordDone() {
    return [true];
  }

  @LogToConsole()
  public keyFromPasswordAndSalt() {
    return [true];
  }

  @LogToConsole()
  public keyFromPasswordAndSaltDone() {
    return [true];
  }

  @LogToConsole()
  public decryptAES() {
    return [true];
  }

  @LogToConsole()
  public decryptAESDone() {
    return [true];
  }

  @LogToConsole()
  public decryptHdCredentialDone() {
    return [true];
  }

  @LogToConsole()
  public revealEntropyToMnemonic() {
    return [true];
  }

  // done
  @LogToConsole()
  public revealEntropyToMnemonicDone() {
    return [true];
  }
}
