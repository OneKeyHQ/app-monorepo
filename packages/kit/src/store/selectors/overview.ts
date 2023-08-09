import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectOverview = (state: IAppState) => state.overview;
