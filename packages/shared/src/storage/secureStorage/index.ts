/* eslint-disable @typescript-eslint/no-unused-vars */
export const setSecureItem = async (key: string, data: string) =>
  Promise.reject(new Error('no supported'));

export const getSecureItem: (key: string) => Promise<string | null> = async (
  key: string,
) => null;

export const removeSecureItem = async (key: string) =>
  Promise.reject(new Error('no supported'));
