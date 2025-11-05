import type { BrowserWindow } from 'electron';

const checkWindowProgressBar = (window: BrowserWindow | undefined) => {
  if (!window || window.setProgressBar === undefined) {
    return false;
  }
  return true;
};

export const updateWindowProgressBar = (
  window: BrowserWindow | undefined,
  progress: number,
) => {
  setTimeout(() => {
    if (!checkWindowProgressBar(window)) {
      return;
    }
    if (progress > 0 && progress < 1) {
      window?.setProgressBar(progress);
    } else {
      window?.setProgressBar(-1);
    }
  });
};

export const clearWindowProgressBar = (window: BrowserWindow | undefined) => {
  setTimeout(() => {
    if (!checkWindowProgressBar(window)) {
      return;
    }
    window?.setProgressBar(-1);
  });
};
