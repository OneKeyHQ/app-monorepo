import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHourglass = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 4h-2v4.535L13.803 12 19 15.465V20h2v2H3v-2h2v-4.535L10.197 12 5 8.535V4H3V2h18zM7 16.535V20h10v-3.465l-5-3.334zm0-9.07 5 3.333 5-3.333V4H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHourglass;
