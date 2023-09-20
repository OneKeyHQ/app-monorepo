import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';

export type ContactBase = {
  name: string;
  address: string;
  networkId: string;
  badge: string;
};

export type Contact = ContactBase & {
  id: number;
  createAt: number;
};

export type ContactsState = {
  uuid: number;
  contacts: Record<string, Contact>;
};

const initialState: ContactsState = {
  uuid: 0,
  contacts: {},
};

export const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    create(state, action: PayloadAction<ContactBase>) {
      const uuid = state.uuid + 1;
      const { payload } = action;
      const now = Date.now();
      state.uuid = uuid;
      state.contacts[uuid] = { id: uuid, createAt: now, ...payload };
    },
    update(
      state,
      action: PayloadAction<{ uuid: number; contact: ContactBase }>,
    ) {
      const { uuid } = action.payload;
      const { contact } = action.payload;
      const oldContact = state.contacts[uuid];
      if (oldContact) {
        state.contacts[uuid] = { ...oldContact, ...contact };
      }
    },
    remove(state, action: PayloadAction<{ uuid: number }>) {
      const { uuid } = action.payload;
      delete state.contacts[uuid];
    },
  },
});

export const { create, update, remove } = contactsSlice.actions;

export default contactsSlice.reducer;
