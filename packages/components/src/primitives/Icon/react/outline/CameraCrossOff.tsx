import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraCrossOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.416 11.5-2.002 2.002 2 2L14 16.916l-2-2-2 2-1.414-1.414 2-2L8.584 11.5l1.414-1.414L12 12.088l2.002-2.002z" />
    <Path
      fillRule="evenodd"
      d="M17.035 6H22v15H2V6h4.965l2-3h6.07zm-9 2H4v11h16V8h-4.035l-2-3h-3.93z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraCrossOff;
