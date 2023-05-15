import { LimitOrderObserver } from './Main/Observers/limitOrder';
import { MiscOberver } from './Main/Observers/misc';
import { SwapObserver } from './Main/Observers/swap';

const Observers = () => (
  <>
    <LimitOrderObserver />
    <SwapObserver />
    <MiscOberver />
  </>
);

export default Observers;
