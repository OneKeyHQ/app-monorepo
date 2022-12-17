import { createSlice } from '@reduxjs/toolkit';

import type {
  KeleDashboardGlobal,
  KeleETHStakingState,
  StakingActivity,
} from '../../views/Staking/typing';
import type { PayloadAction } from '@reduxjs/toolkit';

export type StakingState = {
  showETH2UnableToUnstakeWarning: boolean;
  keleETH2StakingState?: Record<
    string,
    Record<string, KeleETHStakingState | undefined>
  >;
  keleDashboardGlobal?: KeleDashboardGlobal;
  stakingActivities?: Record<
    string,
    Record<string, StakingActivity | undefined>
  >;
};

const initialState: StakingState = {
  showETH2UnableToUnstakeWarning: true,
};

export const stakingSlice = createSlice({
  name: 'staking',
  initialState,
  reducers: {
    setShowETH2UnableToUnstakeWarning: (
      state,
      action: PayloadAction<boolean>,
    ) => {
      state.showETH2UnableToUnstakeWarning = action.payload;
    },
    setKeleETH2StakingState(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        stakingState: KeleETHStakingState;
      }>,
    ) {
      const { networkId, accountId, stakingState } = action.payload;
      if (!state.keleETH2StakingState) {
        state.keleETH2StakingState = {};
      }
      if (!state.keleETH2StakingState?.[accountId]) {
        state.keleETH2StakingState[accountId] = {};
      }
      state.keleETH2StakingState[accountId][networkId] = stakingState;
    },
    setAccountStakingActivity(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        data?: StakingActivity;
      }>,
    ) {
      const { networkId, accountId, data } = action.payload;
      if (!state.stakingActivities) {
        state.stakingActivities = {};
      }
      if (!state.stakingActivities?.[accountId]) {
        state.stakingActivities[accountId] = {};
      }
      state.stakingActivities[accountId][networkId] = data;
    },
    setKeleDashboardGlobal(state, action: PayloadAction<KeleDashboardGlobal>) {
      state.keleDashboardGlobal = action.payload;
    },
  },
});

export const {
  setShowETH2UnableToUnstakeWarning,
  setKeleETH2StakingState,
  setAccountStakingActivity,
  setKeleDashboardGlobal,
} = stakingSlice.actions;

export default stakingSlice.reducer;
