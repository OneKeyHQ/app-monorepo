import type { IRegisterHandler } from './handler.type';

export const registerHandler: IRegisterHandler = () => {
  //
  // export const registerHandler: IRegisterHandler = (handler) => {
  //   const desktopLinkingHandler = (
  //     event: Event,
  //     data: IDesktopOpenUrlEventData,
  //   ) => {
  //     if (process.env.NODE_ENV !== 'production') {
  //       debugLogger.deepLink.info('desktopApi event-open-url', data);
  //     }
  //     handler(data);
  //   };
  //   const desktopApi: DesktopAPI = global.desktopApi as DesktopAPI;
  //   try {
  //     desktopApi.removeIpcEventListener('event-open-url', desktopLinkingHandler);
  //   } catch {
  //     // noop
  //   }
  //   desktopApi.addIpcEventListener('event-open-url', desktopLinkingHandler);
  //   desktopApi.ready();
};
