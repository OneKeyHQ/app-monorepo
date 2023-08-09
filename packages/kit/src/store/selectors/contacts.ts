import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const contacts = (state: IAppState) => state.contacts;

export const selectContacts = createSelector(contacts, (s) => s.contacts);
