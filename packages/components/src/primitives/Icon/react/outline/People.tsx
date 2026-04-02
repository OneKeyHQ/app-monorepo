import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 12c4.758 0 8.084 3.52 8.496 7.906L20.6 21H3.4l.103-1.094C3.916 15.521 7.242 12 12 12m0 2c-3.23 0-5.611 2.091-6.32 5h12.64c-.709-2.909-3.09-5-6.32-5m0-12a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9m0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeople;
