import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalculator = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M5 8V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M5 8h14"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.75}
      d="M9.75 13.125a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Zm0 4.5a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Zm4.5-4.5a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Zm0 4.5a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z"
    />
  </Svg>
);
export default SvgCalculator;
