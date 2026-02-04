import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMic = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 21v-1.054c-3.554-.37-5.701-2.67-6.825-4.402a1 1 0 0 1 1.678-1.088C6.893 16.058 8.8 18 11.999 18c3.2 0 5.108-1.942 6.148-3.544a1 1 0 1 1 1.678 1.088c-1.124 1.731-3.272 4.032-6.826 4.402V21a1 1 0 1 1-2 0Zm4-14a3 3 0 0 0-6 0v4a3 3 0 0 0 6 0zm2 4a5 5 0 0 1-10 0V7a5 5 0 0 1 10 0z" />
  </Svg>
);
export default SvgMic;
