import MetaMaskInpageProvider from './MetaMaskInpageProvider';
import createExternalExtensionProvider from './extension-provider/createExternalExtensionProvider';
import BaseProvider from './BaseProvider';
import {
  initializeProvider,
  setGlobalProvider,
} from './initializeInpageProvider';
import shimWeb3 from './shimWeb3';

export {
  initializeProvider,
  MetaMaskInpageProvider,
  BaseProvider,
  setGlobalProvider,
  shimWeb3,
  createExternalExtensionProvider,
};
