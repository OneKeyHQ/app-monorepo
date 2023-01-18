import fetch from 'cross-fetch';

import { normalizeAxios } from './normalizeAxios';
import { normalizeCrossFetch } from './normalizeCrossFetch';
import { normalizeSuperagent } from './normalizeSuperagent';

export function normalizeRequestLibs() {
  normalizeAxios();
  normalizeSuperagent();
  normalizeCrossFetch({ fetch: fetch as any }); // use patch
  // -----
  // normalizeWs(); // not ready yet
}
