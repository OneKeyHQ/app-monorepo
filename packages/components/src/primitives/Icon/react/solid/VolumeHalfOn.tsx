import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeHalfOn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.472 3.118A1 1 0 0 1 13 4v16a1 1 0 0 1-1.555.832L5.697 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.697l5.748-3.832a1 1 0 0 1 1.027-.05m4.124 4.286a1 1 0 1 0-1.414 1.414A4.48 4.48 0 0 1 16.5 12a4.48 4.48 0 0 1-1.318 3.182 1 1 0 1 0 1.414 1.415A6.48 6.48 0 0 0 18.5 12a6.48 6.48 0 0 0-1.904-4.596" />
  </Svg>
);
export default SvgVolumeHalfOn;
