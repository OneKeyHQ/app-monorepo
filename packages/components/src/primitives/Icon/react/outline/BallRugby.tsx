import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallRugby = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.164 10.25-4.914 4.914-1.414-1.414 4.914-4.914z" />
    <Path
      fillRule="evenodd"
      d="M20 2a2 2 0 0 1 2 2v5q0 .76-.087 1.499l.001.001-.002.001c-.688 5.98-5.431 10.723-11.411 11.411l-.001.002h-.001A13 13 0 0 1 9 22H4a2 2 0 0 1-2-2v-5q0-.761.087-1.5v-.002c.689-5.98 5.432-10.722 11.411-11.41l.002-.002Q14.239 2 15 2zM4 20h4.586L4 15.414zm8.805-15.781a11.01 11.01 0 0 0-8.586 8.586l6.975 6.975a11.01 11.01 0 0 0 8.586-8.586zM20 8.586V4h-4.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBallRugby;
