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
      d="M20.5 9.5q.594-.001 1.153-.121c.226.835.347 1.714.347 2.621 0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2c1.12 0 2.196.184 3.2.523A5.5 5.5 0 0 0 20.5 9.5M13 8a1 1 0 1 0-2 0v4a1 1 0 0 0 .293.707l2.5 2.5a1 1 0 0 0 1.414-1.414L13 11.586z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M18 2a1 1 0 0 1 1-1h3a1 1 0 0 1 .8 1.6L21 5h1a1 1 0 1 1 0 2h-3a1 1 0 0 1-.8-1.6L20 3h-1a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClockSnooze;
