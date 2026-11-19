import { EAtomNames } from '../states/jotai/atomNames';

import BackgroundApiBase from './BackgroundApiBase';

type ITestAtom = {
  get: jest.Mock<Promise<unknown>, []>;
};

function createBackgroundApiWithAtoms(
  atoms: Partial<Record<EAtomNames, ITestAtom>>,
) {
  const backgroundApi = Object.create(
    BackgroundApiBase.prototype,
  ) as BackgroundApiBase;
  backgroundApi.allAtoms = Promise.resolve(atoms as never);
  return backgroundApi;
}

describe('BackgroundApiBase.getAtomStates', () => {
  it('reads only the requested atoms', async () => {
    const localDbState = { errorMessage: 'schema downgrade' };
    const localDbGet = jest.fn(async () => localDbState);
    const passwordGet = jest.fn(async () => ({ unLock: false }));
    const backgroundApi = createBackgroundApiWithAtoms({
      [EAtomNames.localDbOpenErrorAtom]: { get: localDbGet },
      [EAtomNames.passwordAtom]: { get: passwordGet },
    });

    await expect(
      backgroundApi.getAtomStates([EAtomNames.localDbOpenErrorAtom]),
    ).resolves.toEqual({
      states: {
        [EAtomNames.localDbOpenErrorAtom]: localDbState,
      },
    });
    expect(localDbGet).toHaveBeenCalledTimes(1);
    expect(passwordGet).not.toHaveBeenCalled();
  });

  it('keeps the existing full snapshot behavior when names are omitted', async () => {
    const localDbState = { errorMessage: undefined };
    const passwordState = { unLock: false };
    const backgroundApi = createBackgroundApiWithAtoms({
      [EAtomNames.localDbOpenErrorAtom]: {
        get: jest.fn(async () => localDbState),
      },
      [EAtomNames.passwordAtom]: {
        get: jest.fn(async () => passwordState),
      },
    });

    await expect(backgroundApi.getAtomStates()).resolves.toEqual({
      states: {
        [EAtomNames.localDbOpenErrorAtom]: localDbState,
        [EAtomNames.passwordAtom]: passwordState,
      },
    });
  });

  it('rejects an unknown requested atom', async () => {
    const backgroundApi = createBackgroundApiWithAtoms({});

    await expect(
      backgroundApi.getAtomStates(['missingAtom' as EAtomNames]),
    ).rejects.toThrow('getAtomStates ERROR: atomName not found: missingAtom');
  });
});
