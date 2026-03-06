import type { ComponentType } from 'react';

export const AutoSizeInputNativeView: ComponentType<any> | null = null;

export const wrapNitroCallback = <T extends (...args: any[]) => any>(
  callback: T,
): T => callback;

export type IAutoSizeInputRef = {
  focus?: () => void;
};
