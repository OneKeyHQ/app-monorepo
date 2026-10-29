import type * as BackgroundDecorators from '../backgroundDecorators';

const actual = jest.requireActual<typeof BackgroundDecorators>(
  '../backgroundDecorators',
);

const passthrough =
  () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
    descriptor;

module.exports = {
  ...actual,
  backgroundClass: passthrough,
  backgroundMethod: passthrough,
};
