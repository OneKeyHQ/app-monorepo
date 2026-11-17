import { getSesErrorStackFrameCount } from './runtimeCheckErrorStack.native';

// The shared Jest setup mocks Sentry; this regression needs its real parser.
jest.unmock('@sentry/react');

test('native diagnostics reject SES CallSite text without Hermes locations', () => {
  expect(
    getSesErrorStackFrameCount(
      'Error: public fixture\n    at [object CallSite]',
    ),
  ).toBe(0);
  expect(
    getSesErrorStackFrameCount(
      'Error: public fixture\n    at fixture (address at main.jsbundle:1:42)',
    ),
  ).toBe(1);
});
