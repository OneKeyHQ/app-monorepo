module.exports = {
  ...jest.requireActual('react'),
  useEffect: jest.fn((func: () => void) => func()),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  useState: jest.fn((initialState: any) => [initialState, jest.fn()]),
};
