import { createPendingCompletionRefreshOwner } from './stakingPendingCompletion';

describe('pending completion refresh ownership', () => {
  it('lets only the latest completion attempt release the loading guard', () => {
    const owner = createPendingCompletionRefreshOwner();
    const first = owner.begin();
    const second = owner.begin();

    expect(owner.isCurrent(first)).toBe(false);
    expect(owner.isCurrent(second)).toBe(true);

    owner.invalidate();
    expect(owner.isCurrent(second)).toBe(false);
  });
});
