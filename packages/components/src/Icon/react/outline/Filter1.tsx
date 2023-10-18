import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFilter1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18 4H6a2 2 0 0 0-2 2v1.172a2 2 0 0 0 .586 1.414l4.828 4.828A2 2 0 0 1 10 14.828v5.229a1 1 0 0 0 1.351.936l2-.75a1 1 0 0 0 .649-.936v-4.479a2 2 0 0 1 .586-1.414l4.828-4.828A2 2 0 0 0 20 7.172V6a2 2 0 0 0-2-2Z"
    />
  </Svg>
);
export default SvgFilter1;
