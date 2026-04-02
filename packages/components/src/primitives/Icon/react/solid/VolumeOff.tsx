import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 20.928 5.746 17H1V7h4.746L13 3.07v17.857ZM22.914 10l-2.121 2.12 2.121 2.123-1.414 1.414-2.121-2.121-2.121 2.121-1.414-1.414 2.12-2.122L15.845 10l1.414-1.414 2.12 2.12 2.122-2.12z" />
  </Svg>
);
export default SvgVolumeOff;
