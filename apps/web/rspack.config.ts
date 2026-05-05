/* eslint-disable import/no-relative-packages */
import '../../development/env';
import { createWebConfig } from '../../development/rspack/rspack.web.config';

export default createWebConfig({ basePath: __dirname });
