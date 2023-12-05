// import { Linking } from 'react-native';

import type { IRegisterHandler } from './handler.type';

export const registerHandler: IRegisterHandler = () => {
  //
  // export const registerHandler: IRegisterHandler = (handler) => {
  //   const nativeLinkingHandler = ({ url }: { url: string }) => {
  //     handler({ url });
  //   };
  //   void (async () => {
  //     const url = await Linking.getInitialURL();
  //     if (url) {
  //       nativeLinkingHandler({ url });
  //     }
  //   })();
  //   try {
  //     // remove cause app error, and can't catch
  //     // Linking.removeEventListener('url', linkingHandler);
  //   } catch {
  //     // noop
  //   }
  //   Linking.addEventListener('url', nativeLinkingHandler);
};
