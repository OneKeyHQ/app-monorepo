import platformEnv from './platformEnv';

export function toPlainErrorObject(error: {
  className?: any;
  name?: any;
  code?: any;
  data?: any;
  message?: any;
  stack?: any;
}) {
  return {
    className: error.className,
    name: error.name,
    code: error.code,
    data: error.data,
    message: error.message,
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
