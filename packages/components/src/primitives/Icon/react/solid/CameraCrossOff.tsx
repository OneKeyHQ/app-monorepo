import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraCrossOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.035 3a2 2 0 0 0-1.664.89L6.965 6H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.965L15.63 3.89A2 2 0 0 0 13.965 3zm-.744 7.793a1 1 0 0 1 1.414 0L12 12.088l1.295-1.295a1 1 0 0 1 1.414 1.414l-1.295 1.295 1.293 1.293a1 1 0 0 1-1.414 1.414L12 14.916l-1.293 1.293a1 1 0 0 1-1.414-1.414l1.293-1.293-1.295-1.295a1 1 0 0 1 0-1.414"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraCrossOff;
