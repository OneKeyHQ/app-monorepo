import BaseProvider from './BaseProvider';
import {
  initializeProvider,
  setGlobalProvider,
} from './initializeInpageProvider';
import MetaMaskInpageProvider from './MetaMaskInpageProvider';
import shimWeb3 from './shimWeb3';

export {
  initializeProvider,
  MetaMaskInpageProvider,
  BaseProvider,
  setGlobalProvider,
  shimWeb3,
};
