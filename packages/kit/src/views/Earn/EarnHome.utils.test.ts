import { getEarnFocusState } from './EarnHome.utils';

describe('getEarnFocusState', () => {
  it('keeps data active when Earn is only covered by a modal', () => {
    expect(
      getEarnFocusState({
        isFocus: true,
        isHideByModal: true,
      }),
    ).toEqual({
      isVisibleFocus: false,
      isDataActive: true,
    });
  });

  it('marks Earn inactive when the current tab is not Earn', () => {
    expect(
      getEarnFocusState({
        isFocus: false,
        isHideByModal: false,
      }),
    ).toEqual({
      isVisibleFocus: false,
      isDataActive: false,
    });
  });
});
