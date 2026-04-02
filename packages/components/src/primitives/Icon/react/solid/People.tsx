import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.001 12c4.758 0 8.083 3.521 8.495 7.906L20.6 21H3.402l.103-1.094C3.917 15.521 7.243 12 12 12ZM12 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9" />
  </Svg>
);
export default SvgPeople;
