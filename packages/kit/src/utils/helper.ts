import { getTime } from 'date-fns';
import { utils } from 'ethers';
import uuid from 'react-native-uuid';

export const getTimeStamp = () => getTime(new Date());

export const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const timeout = <T>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms);
    p.then((value) => resolve(value)).catch((err) => reject(err));
  });

export const generateUUID = () => uuid.v4() as string;

export const hexlify = (...args: Parameters<typeof utils.hexlify>) =>
  utils.hexlify.apply(utils.hexlify, args);
