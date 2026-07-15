/* eslint-disable import/no-relative-packages */
import '../../development/env';
import { createWebEmbedConfig } from '../../development/rspack/rspack.web-embed.config';

export default createWebEmbedConfig({ basePath: __dirname });
