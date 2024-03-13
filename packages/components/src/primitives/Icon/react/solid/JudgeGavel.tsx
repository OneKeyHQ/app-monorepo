import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgJudgeGavel = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      d="M18.457 4.043a2.768 2.768 0 0 0-3.914 0l-4 4a2.768 2.768 0 0 0 3.914 3.914l1.293-1.293 4.043 4.043a1 1 0 0 0 1.414-1.414L17.164 9.25l1.293-1.293a2.768 2.768 0 0 0 0-3.914Zm-13.75 3.25a1 1 0 0 0-1.414 1.414l1.5 1.5a1 1 0 0 0 1.414-1.414l-1.5-1.5ZM2 12a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H2Zm1.595 6.051A3 3 0 0 1 6.442 16h6.117a3 3 0 0 1 2.846 2.051l.316.949H16a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h.28l.315-.949Z"
    />
  </Svg>
);
export default SvgJudgeGavel;
