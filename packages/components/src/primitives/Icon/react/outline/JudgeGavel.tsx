import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgJudgeGavel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.72 19H17v2H2v-2h1.28l1-3h10.44zM5.388 19h8.226l-.334-1H5.721zM20.414 6l-3.25 3.25 4.75 4.75-1.414 1.414-4.75-4.75-3.25 3.25L8.586 10 16.5 2.086zm-9 4 1.086 1.086L17.586 6 16.5 4.914z"
      clipRule="evenodd"
    />
    <Path d="M5 14H1v-2h4zm1.914-4.5L5.5 10.914 2.586 8 4 6.586z" />
  </Svg>
);
export default SvgJudgeGavel;
