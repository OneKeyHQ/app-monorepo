import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraChangeLens = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7.043 17A7.15 7.15 0 0 0 12 19a7 7 0 0 0 7-7 1 1 0 1 1 2 0 9 9 0 0 1-9 9 9.15 9.15 0 0 1-6-2.244V20a1 1 0 1 1-2 0v-3.25c0-.966.784-1.75 1.75-1.75h3a1 1 0 1 1 0 2H7.043ZM5 12a1 1 0 1 1-2 0 9 9 0 0 1 9-9 9.15 9.15 0 0 1 6.012 2.254V4a1 1 0 0 1 2 0v3.25A1.75 1.75 0 0 1 18.262 9h-3.25a1 1 0 0 1 0-2h1.945A7.151 7.151 0 0 0 12 5a7 7 0 0 0-7 7Z"
    />
    <Path
      fill="currentColor"
      d="M10.75 12a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Z"
    />
  </Svg>
);
export default SvgCameraChangeLens;
