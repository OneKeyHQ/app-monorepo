import { shouldInject } from '../content-script/shouldInject';

if (shouldInject()) {
  require('./content-script-init');
}

export {};
