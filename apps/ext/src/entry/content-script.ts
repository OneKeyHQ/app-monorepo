import { shouldInject } from '../content-script/shouldInject';

if (shouldInject()) {
  require('./content-script-init');
}

// eslint-disable-next-line unicorn/require-module-specifiers
// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
