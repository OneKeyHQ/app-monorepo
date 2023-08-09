import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectHttpServer = (state: IAppState) => state.httpServer;
