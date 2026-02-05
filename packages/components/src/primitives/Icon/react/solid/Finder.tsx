import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFinder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 3h6.917a47 47 0 0 0-1.665 9.942A1 1 0 0 0 11.25 14h2a1 1 0 1 0 0-2h-.928c.252-3.066.814-6.03 1.674-9H19a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m4 6a1 1 0 0 0-2 0v1a1 1 0 1 0 2 0zm8 0a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0zm-8.445 5.668a1 1 0 0 0-1.11 1.664C9.02 17.382 10.466 18 12 18s2.98-.619 4.555-1.668a1 1 0 0 0-1.11-1.664C14.02 15.618 12.966 16 12 16s-2.02-.381-3.445-1.332"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFinder;
