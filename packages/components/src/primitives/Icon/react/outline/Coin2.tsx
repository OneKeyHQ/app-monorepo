import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoin2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13.414 8.5a2 2 0 0 0-2.828 0L8.5 10.586a2 2 0 0 0 0 2.828l2.086 2.086a2 2 0 0 0 2.828 0l2.086-2.086a2 2 0 0 0 0-2.828zm-3.5 3.5L12 9.914 14.086 12 12 14.086z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2M4 12a8 8 0 1 1 16 0 8 8 0 0 1-16 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCoin2;
