import { getTime } from 'date-fns';

export const getTimeStamp = () => getTime(new Date());

export const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const timeout = <T>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms);
    p.then((value) => resolve(value)).catch((err) => reject(err));
  });
