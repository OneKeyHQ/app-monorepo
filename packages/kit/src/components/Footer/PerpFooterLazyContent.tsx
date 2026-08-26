import { PerpFooterTicker } from '../../views/Perp/components/FooterTicker/PerpFooterTicker';
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

export { PerpFooterRefreshButtonLazyImpl, PerpFooterTickerLazyImpl };
