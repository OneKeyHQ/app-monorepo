import platformEnv from '../platformEnv';

export function toPlainErrorObject(error: {
  // js native Error
  name?: any;
  message?: any;
  stack?: any;
  // Web3RpcError
  code?: any;
  data?: any;
  // OneKeyError
  className?: any;
  info?: any;
  key?: any;
}) {
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    data: error.data,
    className: error.className,
    info: error.info,
    key: error.key,
    // Crash in Android hermes engine (error.stack serialize fail, only if Web3Errors object)
    stack: platformEnv.isNativeAndroid
      ? 'Access error.stack failed in Android hermes engine: unable to serialize, circular reference is too complex to analyze'
      : error.stack,
  };
}

export function safeConsoleLogError(error: Error | unknown) {
  if (platformEnv.isNativeAndroid) {
    // sometimes error.stack cause Android hermes engine crash
    delete (error as Error).stack;
  }
  console.error(error);
}
