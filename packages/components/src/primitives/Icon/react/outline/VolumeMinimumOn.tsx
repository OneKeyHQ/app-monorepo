import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeMinimumOn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 20.929 5.747 17H1V7h4.747L13 3.071V20.93ZM6.477 8.879 6.254 9H3v6h3.254l.223.121L11 17.571V6.43L6.477 8.88Z"
      clipRule="evenodd"
    />
    <Path d="M15.535 8.465A4.99 4.99 0 0 1 17 12c0 1.38-.561 2.632-1.465 3.535l-1.414-1.414A2.99 2.99 0 0 0 15 12c0-.829-.335-1.577-.879-2.121z" />
  </Svg>
);
export default SvgVolumeMinimumOn;
