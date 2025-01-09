import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPrinter = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 14v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-5M7 14h10M7 14v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-2m-8-3H7m2-8h6a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgPrinter;
