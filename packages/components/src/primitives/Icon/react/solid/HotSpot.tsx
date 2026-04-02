import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHotSpot = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zm-8.999-6.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5M12 10.75c-1.22 0-2.445.392-3.458 1.182l1.23 1.576A3.62 3.62 0 0 1 12 12.75c.795 0 1.583.255 2.23.759l1.229-1.578A5.62 5.62 0 0 0 12 10.75M12 7c-1.94 0-3.885.623-5.49 1.876l1.23 1.576A6.9 6.9 0 0 1 12 9c1.514 0 3.022.486 4.26 1.452l1.23-1.576A8.9 8.9 0 0 0 12 7"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHotSpot;
