import type { ISkanConversion } from './types';

export { ESkanMilestone, SKAN_COARSE_RULE } from './types';

// SKAdNetwork only exists on iOS.
export const markSkanMilestones: ISkanConversion['markSkanMilestones'] = () =>
  Promise.resolve();

export const markSkanAppOpened: ISkanConversion['markSkanAppOpened'] = () =>
  Promise.resolve();
