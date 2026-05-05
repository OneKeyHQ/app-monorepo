import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgJudgeGavel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m14.72 16 1 3H17v2H2v-2h1.28l1-3zm5.694-10-3.25 3.25 4.75 4.75-1.414 1.414-4.75-4.75-3.25 3.25L8.586 10 16.5 2.086zM5 14H1v-2h4zm1.914-4.5L5.5 10.914 2.586 8 4 6.586z" />
  </Svg>
);
export default SvgJudgeGavel;
