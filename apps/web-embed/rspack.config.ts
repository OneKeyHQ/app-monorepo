/* eslint-disable import/no-relative-packages */
/* eslint-disable onekey/no-raw-error */
import '../../development/env';
import { createWebEmbedConfig } from '../../development/rspack/rspack.web-embed.config';

if (process.env.ONEKEY_WEB_EMBED_CANONICAL_BUILD === 'true') {
  const inputKey = process.env.ONEKEY_WEB_EMBED_BUILD_INPUT_KEY;
  if (!inputKey?.match(/^[0-9a-f]{64}$/u)) {
    throw new Error('Canonical web-embed build input key is invalid.');
  }
  process.env.BUILD_TIME = '0';
  process.env.GITHUB_SHA = inputKey;
  process.env.WORKFLOW_GITHUB_SHA = inputKey;
}

export default createWebEmbedConfig({ basePath: __dirname });
