import platformEnv from '../../platformEnv';

/** only detect device platform now, native all support but ipad not */
const isSupported = platformEnv.isNative && !platformEnv.isNativeIOSPad;

export default isSupported;
