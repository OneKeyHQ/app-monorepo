import { CommonScene } from './scenes/common';
import { WalletScene } from './scenes/wallet';

class Logger {
  wallet = new WalletScene();

  common = new CommonScene();
}

export const defaultLogger = new Logger();
