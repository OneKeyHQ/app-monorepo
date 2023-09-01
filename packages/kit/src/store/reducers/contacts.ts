import { createSlice } from '@reduxjs/toolkit';

import type { Contact } from '../../views/AddressBook/types';
import type { PayloadAction } from '@reduxjs/toolkit';

export type ContactsState = {
  uuid: number;
  contacts: Record<string, Contact>;
  migrate?: boolean;
};

const initialState: ContactsState = {
  uuid: 0,
  contacts: {},
};

export const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    setMigrate(state, action: PayloadAction<boolean>) {
      state.migrate = action.payload;
    },
  },
});

export const { setMigrate } = contactsSlice.actions;

export default contactsSlice.reducer;
