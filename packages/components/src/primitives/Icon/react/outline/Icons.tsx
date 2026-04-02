import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgIcons = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11 21H3v-8h8zm-6-2h4v-4H5z"
      clipRule="evenodd"
    />
    <Path d="m20.535 14.878-2.12 2.121 2.12 2.122-1.414 1.414L17 18.415l-2.122 2.12-1.414-1.414L15.585 17l-2.121-2.121 1.414-1.414.708.707 1.413 1.414 2.122-2.121zM8 6h3v2H8v3H6V8H3V6h3V3h2z" />
    <Path
      fillRule="evenodd"
      d="M17 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgIcons;
