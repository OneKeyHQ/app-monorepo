import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageAddress = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.414 13.414a4 4 0 0 1 5.657 5.657L18.243 21.9l-2.829-2.828a4 4 0 0 1 0-5.657Zm4.243 1.414a2 2 0 0 0-2.829 2.83l1.415 1.413 1.414-1.414a2 2 0 0 0 0-2.829"
      clipRule="evenodd"
    />
    <Path d="M8 9h8V3h5v7.912a6 6 0 0 0-7 9.573l.515.515H3V3h5z" />
    <Path d="M14 7h-4V3h4z" />
  </Svg>
);
export default SvgPackageAddress;
