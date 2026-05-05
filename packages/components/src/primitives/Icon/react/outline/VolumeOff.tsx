import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeOff = (props: SvgProps) => (
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
    <Path d="m22.914 10-2.121 2.121 2.121 2.121-1.414 1.415-2.121-2.122-1.414 1.415-.708.707-1.414-1.415 2.12-2.12L15.844 10l1.414-1.414 2.122 2.121 2.12-2.121z" />
  </Svg>
);
export default SvgVolumeOff;
