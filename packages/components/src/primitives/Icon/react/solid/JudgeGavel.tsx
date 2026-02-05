import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgJudgeGavel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 12a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2zm-.707-4.707a1 1 0 0 1 1.414 0l1.5 1.5a1 1 0 1 1-1.414 1.414l-1.5-1.5a1 1 0 0 1 0-1.414M17.914 3.5a2 2 0 0 0-2.828 0L10 8.586a2 2 0 0 0 0 2.828l1.086 1.086a2 2 0 0 0 2.828 0l1.836-1.836 4.043 4.043a1 1 0 0 0 1.414-1.414L17.164 9.25 19 7.414a2 2 0 0 0 0-2.828zM5.72 16a2 2 0 0 0-1.897 1.367L3.28 19H3a1 1 0 1 0 0 2h13a1 1 0 1 0 0-2h-.28l-.543-1.633A2 2 0 0 0 13.279 16H5.721Z" />
  </Svg>
);
export default SvgJudgeGavel;
