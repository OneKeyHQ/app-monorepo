/**
 * jest.config.js maps '@onekeyhq/components' to a module-wide mock for every
 * suite, so no test in this repo can render real Tamagui. Every DOM assertion
 * about role/tabIndex/aria-* therefore measures the suite's own stub, and would
 * keep passing if the real stack stopped forwarding those props.
 *
 * This closes the half of that gap that can be closed here: the stubs are
 * faithful only while react-native-web still forwards these attributes, so
 * assert that against the real library rather than trusting it.
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires, global-require */
// Required, not imported: jest does not transform this package's dist build.
const { accessibilityProps, defaultProps } =
  require('react-native-web/dist/cjs/modules/forwardedProps') as {
    accessibilityProps: Record<string, boolean>;
    defaultProps: Record<string, boolean>;
  };

describe('react-native-web prop forwarding the Borrow a11y work relies on', () => {
  it.each([
    ['aria-expanded', 'the position card disclosure'],
    ['aria-checked', 'the e-mode category rows'],
    ['aria-disabled', 'a category that cannot be switched into'],
    ['aria-label', 'the labelled collateral marks'],
    ['role', 'every control built from an XStack'],
  ])('still forwards %s, which %s depends on', (prop) => {
    expect(accessibilityProps[prop]).toBe(true);
  });

  // tabIndex is not an accessibility prop to react-native-web; it rides in the
  // default group, so it has to be checked separately.
  it('still forwards tabIndex, which the keyboard path depends on', () => {
    expect(defaultProps.tabIndex).toBe(true);
  });

  // The reason those aria-* props are passed explicitly in the first place:
  // react-native-web 0.21 stopped reading the grouped RN prop, so anything
  // relying on accessibilityState alone reaches no DOM attribute at all.
  it('does not forward accessibilityState, so native-only state needs an aria twin', () => {
    expect('accessibilityState' in accessibilityProps).toBe(false);
  });
});
