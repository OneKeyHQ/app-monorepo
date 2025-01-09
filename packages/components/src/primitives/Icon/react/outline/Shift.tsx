import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShift = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m2.404 11.261 8.922-8.145a1 1 0 0 1 1.348 0l8.922 8.145c.674.616.239 1.739-.674 1.739H17v5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-5H3.078c-.913 0-1.348-1.123-.674-1.739Z"
    />
  </Svg>
);
export default SvgShift;
