import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartColumnarSignal = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5.665 13.777c-.92 0-1.665.746-1.665 1.665v2.893a1.665 1.665 0 0 0 3.33 0v-2.893c0-.92-.745-1.665-1.665-1.665Zm6.33-4.443c-.92 0-1.665.745-1.665 1.665v7.337a1.665 1.665 0 1 0 3.33 0v-7.337c0-.92-.745-1.665-1.665-1.665ZM18.335 4c-.92 0-1.665.745-1.665 1.665v12.67a1.665 1.665 0 1 0 3.33 0V5.665C20 4.745 19.255 4 18.335 4Z"
    />
  </Svg>
);
export default SvgChartColumnarSignal;
