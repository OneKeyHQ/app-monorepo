/* eslint-disable import/no-relative-packages */
import '../../development/env';
import { createExtConfig } from '../../development/rspack/rspack.ext.config';

export default createExtConfig({ basePath: __dirname });
