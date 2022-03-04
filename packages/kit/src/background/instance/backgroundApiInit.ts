import BackgroundApi from '../BackgroundApi';

function backgroundApiInit() {
  const backgroundApi = new BackgroundApi();

  global.$backgroundApi = backgroundApi;
  return backgroundApi;
}

export default backgroundApiInit;
