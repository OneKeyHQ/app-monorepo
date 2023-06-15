import fetch from 'cross-fetch';

import { normalizeAxios } from './normalizeAxios';
import { normalizeCrossFetch } from './normalizeCrossFetch';
import { normalizeSuperagent } from './normalizeSuperagent';

export function normalizeRequestLibs() {
  normalizeAxios();
  normalizeSuperagent();
  // **** this won't work, please check .yarn/patches/cross-fetch-npm-3.1.5-e414995db9.patch
  normalizeCrossFetch({ fetch: fetch as any }); // use patch
  // -----
  // normalizeWs(); // not ready yet
}
