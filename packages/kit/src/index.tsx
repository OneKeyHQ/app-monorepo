import { updateInterceptorRequestHelper } from '@onekeyhq/kit-bg/src/init/updateInterceptorRequestHelper';

updateInterceptorRequestHelper();
// getIpTableConfig starts as null here. On ALL platforms, BackgroundApiBase
// will later call updateInterceptorRequestHelperWithIpTable() to install
// the real simpleDb-backed implementation. That file is kept separate so
// import('simpleDb') never enters the native main graph.
export { KitProvider } from './provider';
// export { DemoPushKitProvider as KitProvider } from './provider/demo/push/DemoPushKitProvider';
