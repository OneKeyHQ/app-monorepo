import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSunUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M3 19a1 1 0 1 0 0 2zm18 2a1 1 0 1 0 0-2zM11 8a1 1 0 1 0 2 0zm2-4a1 1 0 1 0-2 0zM7 16a1 1 0 1 0 2 0zm8 0a1 1 0 1 0 2 0zM3 15a1 1 0 1 0 0 2zm1 2a1 1 0 1 0 0-2zm16-2a1 1 0 1 0 0 2zm1 2a1 1 0 1 0 0-2zm-3.514-6.908a1 1 0 1 0 1.286 1.532zm2.052.889a1 1 0 0 0-1.286-1.532zM5.748 9.449a1 1 0 1 0-1.285 1.532zm-.52 2.175a1 1 0 0 0 1.286-1.532L5.23 11.624Zm3.065-7.331a1 1 0 0 0 1.414 1.414zM12 2l.707-.707a1 1 0 0 0-1.414 0zm2.293 3.707a1 1 0 1 0 1.414-1.414zM3 21h18v-2H3zM13 8V4h-2v4zm-4 8a3 3 0 0 1 3-3v-2a5 5 0 0 0-5 5zm3-3a3 3 0 0 1 3 3h2a5 5 0 0 0-5-5zm-9 4h1v-2H3zm17 0h1v-2h-1zm-1.228-5.376.766-.643-1.286-1.532-.766.643zm-14.31-.643.767.643 1.285-1.532-.766-.643zm5.245-5.274 3-3-1.414-1.414-3 3zm1.586-3 3 3 1.414-1.414-3-3z"
    />
  </Svg>
);
export default SvgSunUp;
