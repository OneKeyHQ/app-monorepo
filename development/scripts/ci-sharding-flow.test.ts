describe('ci sharding flow probe', () => {
  it('fails intentionally so the sharded unit test workflow can be verified', () => {
    expect('ci-sharding-flow').toBe('ci-sharding-flow-restored');
  });
});
