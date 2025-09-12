import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRenew = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 5a7 7 0 0 0-4 12.745V15a1 1 0 1 1 2 0v5a1 1 0 0 1-1 1H4a1 1 0 1 1 0-2h2.343a9 9 0 0 1 9.032-15.345 1 1 0 1 1-.75 1.853A7 7 0 0 0 12 5"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M13 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2m8-10a1 1 0 1 0-2 0 1 1 0 0 0 2 0m-1.07 3.268a1 1 0 1 1-1 1.732 1 1 0 0 1 1-1.732m-2.562 5.026a1 1 0 1 0-1-1.732 1 1 0 0 0 1 1.732M18.927 8a1 1 0 1 1-1-1.732 1 1 0 0 1 1 1.732"
    />
  </Svg>
);
export default SvgRenew;
