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
    <Path d="M12.001 12q.709 0 1.372.102A5 5 0 0 0 13 14c0 1.522.68 2.883 1.75 3.799V21H3.402l.103-1.094C3.917 15.521 7.243 12 12 12ZM12 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9" />
  </Svg>
);
export default SvgPassword;
