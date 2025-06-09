import { buildSupportUrl } from './utils';

export const initIntercom = async () => {};

export const showIntercom = async () => {
  const supportUrl = await buildSupportUrl();

  const width = 380;
  const height = 640;

  // Calculate center position
  const screenWidth = window.screen?.width || 1366;
  const screenHeight = window.screen?.height || 768;
  const left = Math.round((screenWidth - width) / 2);
  const top = Math.round((screenHeight - height) / 2);

  window.open(
    supportUrl,
    'OneKey',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=no,resizable=yes,toolbar=no,menubar=no,location=no,status=no`,
  );
};
