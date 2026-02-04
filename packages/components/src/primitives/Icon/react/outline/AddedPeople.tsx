import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddedPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.124 11.993c1.205 0 2.33.23 3.341.657a.987.987 0 0 1-.766 1.819 6.6 6.6 0 0 0-2.575-.503c-3.198 0-5.534 2.07-6.234 4.931h5.247a.987.987 0 0 1 0 1.973H5.81c-1.12 0-2.162-1-1.876-2.272l.086-.35c.954-3.586 3.997-6.255 8.105-6.255Zm7.043 2.451a.987.987 0 0 1 1.693 1.016l-2.96 4.93a.99.99 0 0 1-1.437.281l-1.973-1.48a.986.986 0 1 1 1.184-1.577l1.097.823 2.396-3.994ZM14.59 6.57a2.466 2.466 0 1 0-4.932 0 2.466 2.466 0 0 0 4.932 0m1.973 0a4.439 4.439 0 1 1-8.877-.001 4.439 4.439 0 0 1 8.877 0Z" />
  </Svg>
);
export default SvgAddedPeople;
