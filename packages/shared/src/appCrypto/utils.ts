import bufferUtils from '../utils/bufferUtils';

export const AppCryptoTestEmoji = {
  isCorrect: '✅',
  isIncorrect: '❌❌❌❌❌❌❌❌❌❌',
  isSlow: '🐌🐌🐌🐌🐌🐌🐌🐌🐌🐌🐌',
  isWarning: '⚠️',
};

export type IRunAppCryptoTestTaskResult = {
  name: string;
  result?: string;
  ERROR?: string;
  time: number;
  isSlow: string | undefined;
  isPromise: boolean;
  isCorrect: string | undefined;
};
export async function runAppCryptoTestTask({
  name,
  expect,
  fn,
}: {
  name: string;
  expect: string;
  fn: () => Promise<Buffer | string> | Buffer | string;
}): Promise<IRunAppCryptoTestTaskResult> {
  const start = Date.now();
  let result: string | undefined = '';
  let error: string | undefined = '';
  let isPromise = false;
  try {
    const p = fn();
    if (p instanceof Promise) {
      result = bufferUtils.bytesToHex(await p);
      isPromise = true;
    } else {
      result = bufferUtils.bytesToHex(p);
    }
  } catch (e) {
    error = (e as Error | undefined)?.message ?? 'Error';
  }
  const end = Date.now();

  console.log(`${name} took ${end - start}ms: ${result}`);
  const t: IRunAppCryptoTestTaskResult = {
    name,
    result: result || undefined,
    time: end - start,
    isSlow: end - start > 10 && !error ? AppCryptoTestEmoji.isSlow : undefined,
    isPromise,
    ERROR: error ? `${AppCryptoTestEmoji.isWarning} ${error}` : undefined,
    isCorrect: (() => {
      if (result === expect) return AppCryptoTestEmoji.isCorrect;
      if (error) return AppCryptoTestEmoji.isWarning;
      return AppCryptoTestEmoji.isIncorrect;
    })(),
  };
  return t;
}
