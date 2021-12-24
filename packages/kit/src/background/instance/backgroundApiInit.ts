import BackgroundApi from '../BackgroundApi';

import walletApi from './walletApi';

function backgroundApiInit() {
  const backgroundApi = new BackgroundApi({
    walletApi,
  });

  global.$backgroundApi = backgroundApi;
  return backgroundApi;
}

export default backgroundApiInit;
