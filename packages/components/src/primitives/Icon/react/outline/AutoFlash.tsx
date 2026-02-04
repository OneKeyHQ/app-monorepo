import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAutoFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.332 1.459C12.193.372 14 .964 14 2.401V8h5.566c1.198 0 1.912 1.335 1.248 2.332l-8.066 12.099c-.823 1.235-2.748.652-2.748-.832V16H4.435c-1.198 0-1.913-1.335-1.248-2.332l8.065-12.099zM12 19.946 18.63 10H13.5A1.5 1.5 0 0 1 12 8.5V4.053L5.37 14h5.13a1.5 1.5 0 0 1 1.5 1.5zm9.429-5.929a1 1 0 0 1 .799.773l1.5 7a1 1 0 0 1-1.956.42l-.152-.71h-3.36l-.67 1.041a1 1 0 0 1-1.68-1.082l4.5-7 .09-.12a1 1 0 0 1 .929-.322M19.546 19.5h1.646l-.413-1.92z" />
  </Svg>
);
export default SvgAutoFlash;
