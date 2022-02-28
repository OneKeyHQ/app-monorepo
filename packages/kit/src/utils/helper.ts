import { getTime } from 'date-fns';

export const getTimeStamp = () => getTime(new Date());

export const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
