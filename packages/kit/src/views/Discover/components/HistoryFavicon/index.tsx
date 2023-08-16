import { useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import DAppIcon from '../DAppIcon';

export const HistoryFavicon = ({
  logoURL,
  url,
}: {
  logoURL: string;
  url: string;
}) => {
  useEffect(() => {
    if (!logoURL && url) {
      backgroundApiProxy.serviceDiscover.fillInUserBrowserHistory({ url });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <DAppIcon size={48} url={logoURL} borderRadius={12} mb="1.5" />;
};
