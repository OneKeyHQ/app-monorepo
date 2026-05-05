import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPassword = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 11a3 3 0 0 1 1.25 5.727V18l-.75.75.75.677V20.5l-1.25 1-1.25-1v-3.773A3 3 0 0 1 18 11m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
    <Path d="M12 12q.573 0 1.121.067l-.243 1.986A7 7 0 0 0 12 14c-3.23 0-5.611 2.091-6.32 5H15v2H3.401l.103-1.094C3.916 15.521 7.242 12 12 12" />
    <Path
      fillRule="evenodd"
      d="M12 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9m0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPassword;
