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
      d="M14.793 13.171a4 4 0 0 1 5.657 5.658l-2.121 2.12a1 1 0 0 1-1.415 0l-2.122-2.12a4 4 0 0 1 0-5.658Zm4.243 1.414a2 2 0 0 0-2.83 2.83l1.416 1.414 1.414-1.414a2 2 0 0 0 0-2.83"
      clipRule="evenodd"
    />
    <Path d="M7.378 6.757a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4h3a2 2 0 0 1 2 2v5.912a6 6 0 0 0-7 9.573l.515.515H4.378a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2h3z" />
    <Path d="M13.378 6.757h-4v-4h4z" />
  </Svg>
);
export default SvgPackageAddress;
