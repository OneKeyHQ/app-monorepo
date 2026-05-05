import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgQrCode = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 18H6v-2h2z" />
    <Path
      fillRule="evenodd"
      d="M11 21H3v-8h8zm-6-2h4v-4H5z"
      clipRule="evenodd"
    />
    <Path d="M15 21h-2v-2h2zm6-2h-2v2h-2v-4h4zm-6-4h2v2h-4v-4h2zm6 0h-4v-2h4zM8 8H6V6h2z" />
    <Path fillRule="evenodd" d="M11 11H3V3h8zM5 9h4V5H5z" clipRule="evenodd" />
    <Path d="M18 8h-2V6h2z" />
    <Path
      fillRule="evenodd"
      d="M21 11h-8V3h8zm-6-2h4V5h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgQrCode;
