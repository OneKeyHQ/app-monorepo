import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLab2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m14.71 4.292 5.002 5.002 1.702 1.709-1.417 1.411-.995-.999-9.295 9.293a4.536 4.536 0 0 1-6.413-6.415l9.294-9.292-1.002-.998 1.41-1.417zM4.708 15.707a2.536 2.536 0 0 0 3.585 3.587L13.588 14H6.415zM8.415 12h7.173l2-2.001-3.585-3.586z"
      clipRule="evenodd"
    />
    <Path d="M20.01 5a1 1 0 1 1 0 2H20a1 1 0 1 1 0-2zM18.5 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
  </Svg>
);
export default SvgLab2;
