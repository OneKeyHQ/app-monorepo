import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraAuto = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.035 6H22v15H2V6h4.965l2-3h6.07zm-9 2H4v11h16V8h-4.035l-2-3h-3.93z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M16.162 16.84a1 1 0 0 1 .056.16h-2.176l-.448-1h-3.188l-.448 1H7.781a1 1 0 0 1 .056-.16L10.903 10h2.193zM11.302 14h1.395L12 12.444 11.303 14Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraAuto;
