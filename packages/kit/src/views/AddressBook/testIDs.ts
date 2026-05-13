export const AddressBookTestIDs = {
  // --- ListItem Page ---
  searchBar: 'address-book-search-bar',
  safeNotificationBtn: 'address-book-safe-notification-btn',
  addIconBtn: 'address-book-add-icon', // preserve existing
  addFooterBtn: 'address-book-add-footer-btn',

  // --- PickItem Page ---
  pickSearchBar: 'address-book-pick-search-bar',
  pickAddBtn: 'address-book-add-icon', // preserve existing (shared with ListItem page)

  // --- CreateOrEditContent ---
  formRemoveBtn: 'address-form-remove', // preserve existing
  formNameField: 'address-form-name-field', // preserve existing (Form.Field wrapper)
  formNameInput: 'address-form-name', // preserve existing (inner Input)
  formAddressField: 'address-form-address-field', // preserve existing (Form.Field wrapper)
  formAddressInput: 'address-form-address', // preserve existing (inner AddressInput)
  formMemoInput: 'address-book-form-memo-input',
  formNoteInput: 'address-book-form-note-input',
  formSaveBtn: 'address-book-form-save-btn',
} as const;
