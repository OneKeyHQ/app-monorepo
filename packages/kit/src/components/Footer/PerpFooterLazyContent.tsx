import { PerpFooterTicker } from '../../views/Perp/components/FooterTicker/PerpFooterTicker';
import { PerpNetworkStatus } from '../../views/Perp/components/PerpNetworkStatus';
import { PerpsProviderMirror } from '../../views/Perp/PerpsProviderMirror';
import { PerpRefreshButton } from '../PerpRefreshButton';

function PerpFooterRefreshButtonLazyImpl() {
  return (
    <PerpsProviderMirror>
      <PerpRefreshButton />
    </PerpsProviderMirror>
  );
}

function PerpFooterTickerLazyImpl() {
  return (
    <PerpsProviderMirror>
      <PerpFooterTicker />
    </PerpsProviderMirror>
  );
}

function PerpFooterNetworkStatusLazyImpl() {
  return <PerpNetworkStatus />;
}

export {
  PerpFooterNetworkStatusLazyImpl,
  PerpFooterRefreshButtonLazyImpl,
  PerpFooterTickerLazyImpl,
};
