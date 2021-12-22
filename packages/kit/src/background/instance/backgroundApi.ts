import BackgroundApi from '../BackgroundApi';

import walletApi from './walletApi';

const backgroundApi = new BackgroundApi({
  walletApi,
});

export default backgroundApi;
