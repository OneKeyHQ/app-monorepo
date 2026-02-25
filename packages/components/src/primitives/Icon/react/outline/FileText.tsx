import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.5 18H8v-2h8.5zM13 14H8v-2h5z" />
    <Path
      fillRule="evenodd"
      d="M20 8.586V22H4V2h9.414zM6 20h12V10h-6V4H6zm8-12h2.586L14 5.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFileText;
