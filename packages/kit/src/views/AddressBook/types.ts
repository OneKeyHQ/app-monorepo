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
  migrate?: boolean;
};
