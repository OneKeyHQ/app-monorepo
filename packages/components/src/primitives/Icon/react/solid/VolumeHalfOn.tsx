import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeHalfOn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 20.928 5.746 17H1V7h4.746L13 3.07v17.857Zm3.597-13.524a6.48 6.48 0 0 1 1.903 4.597 6.48 6.48 0 0 1-1.903 4.595l-1.414-1.414a4.48 4.48 0 0 0 1.317-3.181 4.48 4.48 0 0 0-1.317-3.183z" />
  </Svg>
);
export default SvgVolumeHalfOn;
