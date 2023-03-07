import type { MoneroCoreInstance } from './moneroCoreTypes';

class MoneroCoreModule {
  instance: MoneroCoreInstance;

  constructor(instance: MoneroCoreInstance) {
    this.instance = instance;
  }

  generateKeyImage(params: {
    txPublicKey: string;
    privateViewKey: string;
    privateSpendKey: string;
    publicSpendKey: string;
    outputIndex: number;
  }) {
    const {
      txPublicKey,
      privateSpendKey,
      privateViewKey,
      publicSpendKey,
      outputIndex,
    } = params;

    const retString = this.instance.generate_key_image(
      txPublicKey,
      privateViewKey,
      publicSpendKey,
      privateSpendKey,
      outputIndex,
    );
    const ret = JSON.parse(retString);
    if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
      throw ret.err_msg;
    }
    return ret.retVal;
  }
}

export { MoneroCoreModule };
