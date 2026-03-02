import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeMinimumOn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 20.928 5.746 17H1V7h4.746L13 3.07v17.857Zm2.535-12.463A5 5 0 0 1 17 12a5 5 0 0 1-1.465 3.536l-1.414-1.414A3 3 0 0 0 15 12c0-.829-.335-1.577-.879-2.121z" />
  </Svg>
);
export default SvgVolumeMinimumOn;
