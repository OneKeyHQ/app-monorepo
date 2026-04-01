import {
  type IRecipientTabMatchStatus,
  getAutoSwitchRecipientTab,
} from './recipientQuickSelectTabUtils';

const emptyStatus: IRecipientTabMatchStatus = {
  recent: null,
  account: null,
  addressBook: null,
};

describe('recipientQuickSelectTabUtils', () => {
  it('does not switch when search is inactive or key is empty', () => {
    expect(
      getAutoSwitchRecipientTab({
        isSearchMode: false,
        trimmedSearchKey: 'abc',
        activeTab: 'recent',
        tabMatchStatus: emptyStatus,
      }),
    ).toBeUndefined();

    expect(
      getAutoSwitchRecipientTab({
        isSearchMode: true,
        trimmedSearchKey: '',
        activeTab: 'recent',
        tabMatchStatus: emptyStatus,
      }),
    ).toBeUndefined();
  });

  it('does not switch when active tab already has matches', () => {
    expect(
      getAutoSwitchRecipientTab({
        isSearchMode: true,
        trimmedSearchKey: 'abc',
        activeTab: 'recent',
        tabMatchStatus: {
          recent: true,
          account: false,
          addressBook: true,
        },
      }),
    ).toBeUndefined();
  });

  it('switches to the first tab with matches in priority order', () => {
    expect(
      getAutoSwitchRecipientTab({
        isSearchMode: true,
        trimmedSearchKey: 'abc',
        activeTab: 'recent',
        tabMatchStatus: {
          recent: false,
          account: true,
          addressBook: true,
        },
      }),
    ).toBe('account');
  });

  it('does not switch after manual tab switch until search key changes', () => {
    expect(
      getAutoSwitchRecipientTab({
        isSearchMode: true,
        trimmedSearchKey: 'abc',
        activeTab: 'recent',
        tabMatchStatus: {
          recent: false,
          account: true,
          addressBook: true,
        },
        lastManualSwitchSearchKey: 'abc',
      }),
    ).toBeUndefined();
  });
});
