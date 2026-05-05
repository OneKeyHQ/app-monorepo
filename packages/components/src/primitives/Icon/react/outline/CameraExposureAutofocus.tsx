import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureAutofocus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h4v2H3v-6h2zm16 2h-6v-2h4v-4h2zM9 5H5v4H3V3h6zm12 4h-2V5h-4V3h6z" />
    <Path
      fillRule="evenodd"
      d="M15.947 15.818q.033.09.053.182h-2.063l-.425-1.143h-3.024L10.063 16H8q.019-.092.053-.182L10.96 8h2.078zm-4.608-3.247h1.322L12 10.794z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraExposureAutofocus;
