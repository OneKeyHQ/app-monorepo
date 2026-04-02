import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRainy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m7.842 17.553-1.895 3.789-1.789-.895 1.895-3.789zm5 0-1.895 3.789-1.789-.895 1.895-3.789zm5 0-1.895 3.789-1.789-.895 1.895-3.789zM9.5 2a6.5 6.5 0 0 1 5.536 3.093A5 5 0 1 1 16 15H9.5a6.5 6.5 0 1 1 0-13" />
  </Svg>
);
export default SvgRainy;
