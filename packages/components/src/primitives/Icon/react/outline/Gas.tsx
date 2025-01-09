import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGas = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 20h1m-1 0V10m0 10H4m10-10V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14m10-10h2a2 2 0 0 1 2 2v3.5a1.5 1.5 0 0 0 3 0V8.828a2 2 0 0 0-.586-1.414L19 6M3 20h1m7-10H7"
    />
  </Svg>
);
export default SvgGas;
