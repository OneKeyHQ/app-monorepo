import type { IUseSource } from './type';

export const useSource: IUseSource = (source, src) =>
  src ? { uri: src } : source;
