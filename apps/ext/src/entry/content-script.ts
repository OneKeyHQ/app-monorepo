import { shouldInject } from '../content-script/shouldInject';

if (shouldInject()) {
  require('./content-script-init');
}

// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
