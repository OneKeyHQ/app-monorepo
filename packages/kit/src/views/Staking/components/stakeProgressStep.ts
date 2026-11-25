// Kept apart from StakeProgress, so the utils that name a step don't load the
// component (and its SVG) with it
export enum EStakeProgressStep {
  approve = 1,
  deposit = 2,
  unstake = 3,
}
