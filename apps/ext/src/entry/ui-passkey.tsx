import 'setimmediate';

import uiJsBridge from '../ui/uiJsBridge';

uiJsBridge.init();
const renderApp: typeof import('../ui/renderPassKeyPage').default =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  require('../ui/renderPassKeyPage').default;

renderApp();
