import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCake = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18 16.677-.257.103c-.477.19-1.01.19-1.486 0l-1.757-.703-1.757.703c-.477.19-1.01.19-1.486 0L9.5 16.077l-1.757.703c-.477.19-1.01.19-1.486 0L6 16.676V20h12zM11.293 4.293a1 1 0 1 0 1.414 0L12 3.586zM5.5 11v3.323l1.5.6 1.757-.703c.477-.19 1.01-.19 1.486 0l1.757.703 1.757-.703c.477-.19 1.01-.19 1.486 0l1.757.703 1.5-.6V11zm15 3.323c0 .497-.185.963-.5 1.321V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4.356a2 2 0 0 1-.5-1.321V11a2 2 0 0 1 2-2H11V7.825a3 3 0 0 1-1.121-.703 3 3 0 0 1 0-4.243L12 .758l2.122 2.12a3 3 0 0 1 0 4.244A3 3 0 0 1 13 7.825V9h5.5a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCake;
