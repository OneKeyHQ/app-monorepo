import { updateInterceptorRequestHelper } from '@onekeyhq/kit-bg/src/init/updateInterceptorRequestHelper';

updateInterceptorRequestHelper();
// Native main reads IP Table config through the background proxy. BackgroundApiBase
// installs the local SimpleDB provider in bg and on single-runtime platforms.
// Keep that provider separate so SimpleDB never enters the native main graph.
export { KitProvider } from './provider';
// export { DemoPushKitProvider as KitProvider } from './provider/demo/push/DemoPushKitProvider';
