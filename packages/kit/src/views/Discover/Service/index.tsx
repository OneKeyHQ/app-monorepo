import axios from 'axios';

import { RankingsPayload, SyncRequestPayload } from '../type';

const host = 'https://dapp-server.onekey.so';
// const host = 'https://dapp-test-server.onekey.so';

export const imageUrl = (id: string) =>
  `https://dapp-server.onekey.so/gallery/${id}`;

export async function requestSync(timestamp: number, locale: string) {
  const apiUri = `${host}/api/v1.0/sync/${locale.replace(
    /-/g,
    '_',
  )}/${timestamp}`;
  const data = await axios
    .get<SyncRequestPayload>(apiUri)
    .then((resp) => resp.data)
    .catch(() => '404');
  return data;
}

export async function requestRankings() {
  const apiUri = `${host}/api/v1.0/rankings`;
  const data = await axios
    .get<RankingsPayload>(apiUri)
    .then((resp) => resp.data)
    .catch(() => '404');
  return data;
}
