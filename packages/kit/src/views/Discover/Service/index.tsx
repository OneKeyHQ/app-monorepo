import axios from 'axios';

import { RankingsPayload, SyncRequestPayload } from '../type';

const host = 'https://dapp-server.onekey.so';
// const host = 'https://dapp-test-server.onekey.so';

const syncUri = (timestamp: number, locale: string) =>
  `${host}/api/v1.0/sync/${locale.replaceAll('-', '_')}/${timestamp}`;

const rankingsUri = () => `${host}/api/v1.0/rankings`;

export const imageUrl = (id: string) =>
  `https://dapp-server.onekey.so/gallery/${id}`;

export const requestSync = async (timestamp: number, locale: string) =>
  axios.get<SyncRequestPayload>(syncUri(timestamp, locale));

export const requestRankings = async () =>
  axios.get<RankingsPayload>(rankingsUri());
