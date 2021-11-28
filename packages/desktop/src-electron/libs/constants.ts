export const PROTOCOL = 'file';

export const MODULES = [
  'bridge',
  // 'request-filter' // TODO ignore request-filters
];

// Modules only used in prod mode
export const MODULES_PROD = ['file-protocol'];

// Modules only used in dev mode
export const MODULES_DEV = [];
