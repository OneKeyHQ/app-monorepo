import { EPassKeyWindowFrom } from '@onekeyhq/shared/src/utils/extUtils';

const params = new URLSearchParams(globalThis.location.href.split('?').pop());
const from = params.get('from') as EPassKeyWindowFrom;

export const closeWindow = () => {
  if (from === EPassKeyWindowFrom.sidebar) {
    setTimeout(() => {
      window.close();
    }, 50);
  }
};
