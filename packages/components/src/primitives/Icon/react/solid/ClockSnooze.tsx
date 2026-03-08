import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClockSnooze = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a10 10 0 0 1 3.2.523 5.5 5.5 0 0 0 6.453 6.855c.227.836.347 1.715.347 2.622 0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1 10.414 3.5 3.5 1.414-1.414L13 11.586V7h-2z"
      clipRule="evenodd"
    />
    <Path d="M23 2.62 20.96 5H23v2h-5V5.38L20.04 3H18V1h5z" />
  </Svg>
);
export default SvgClockSnooze;
