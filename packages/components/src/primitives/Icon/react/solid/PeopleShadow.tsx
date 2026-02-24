import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleShadow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.499 12c3.47 0 6.64 2.857 6.997 7.93l.075 1.07H.426L.5 19.93C.859 14.857 4.028 12 7.499 12m8.999 0c3.47 0 6.64 2.857 6.998 7.93l.075 1.07h-6.995l-.085-1.21c-.207-2.937-1.265-5.38-2.863-7.09a6.2 6.2 0 0 1 2.87-.7M7.499 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8m9 0a4 4 0 1 1 0 8 4 4 0 0 1 0-8" />
  </Svg>
);
export default SvgPeopleShadow;
