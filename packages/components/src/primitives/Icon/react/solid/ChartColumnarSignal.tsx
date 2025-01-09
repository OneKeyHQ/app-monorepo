import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartColumnarSignal = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M15.67 5.665a2.665 2.665 0 0 1 5.33 0v12.67a2.665 2.665 0 1 1-5.33 0V5.665Zm-3.675 2.669a2.665 2.665 0 0 0-2.665 2.665v7.337a2.665 2.665 0 1 0 5.33 0v-7.337a2.665 2.665 0 0 0-2.665-2.665Zm-6.33 4.443A2.665 2.665 0 0 0 3 15.442v2.893a2.665 2.665 0 0 0 5.33 0v-2.893a2.665 2.665 0 0 0-2.665-2.665Z"
    />
  </Svg>
);
export default SvgChartColumnarSignal;
