import { BlockBook } from './blockbook';
import { Provider } from './provider';

export const BtcForkImpl = {
  doge: {
    Provider,
    BlockBook,
  },
};

export { Provider, BlockBook };
