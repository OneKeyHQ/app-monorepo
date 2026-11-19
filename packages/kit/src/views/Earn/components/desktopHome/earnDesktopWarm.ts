import {
  preloadEarnLendingDetails,
  preloadEarnPositions,
  preloadEarnProtocolDetails,
} from '@onekeyhq/kit/src/routes/Tab/Earn/router';

// The pages the home opens load while what opens them is pointed at or
// focused, so a first open shows the page at once rather than the route's
// loading screen
export const warmEarnPositions = () => {
  preloadEarnPositions().catch(() => undefined);
};

export const warmEarnProtocolDetails = () => {
  preloadEarnProtocolDetails().catch(() => undefined);
};

export const warmEarnLendingDetails = () => {
  preloadEarnLendingDetails().catch(() => undefined);
};
