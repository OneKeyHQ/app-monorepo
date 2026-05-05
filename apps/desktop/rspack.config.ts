/* eslint-disable import/no-relative-packages */
import '../../development/env';
import { createDesktopConfig } from '../../development/rspack/rspack.desktop.config';

export default createDesktopConfig({ basePath: __dirname });
