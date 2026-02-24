// eslint-disable-next-line import-path/forbidden
import { startKeylessCloudSyncMockServer } from './index';

const host = process.env.KEYLESS_CLOUD_SYNC_MOCK_SERVER_HOST ?? '127.0.0.1';
const portRaw = process.env.KEYLESS_CLOUD_SYNC_MOCK_SERVER_PORT;
const port = portRaw ? Number.parseInt(portRaw, 10) : undefined;

startKeylessCloudSyncMockServer({
  host,
  port: Number.isFinite(port) ? port : undefined,
});
