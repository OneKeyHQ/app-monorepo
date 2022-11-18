import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { setIncomingUrl } from '../../../../store/reducers/webTabs';

const clearIncomingUrl = () => backgroundApiProxy.dispatch(setIncomingUrl(''));

export const useIncomingUrl = () => {
  const incomingUrl = useAppSelector((s) => s.webTabs.incomingUrl);

  return { incomingUrl, clearIncomingUrl };
};
