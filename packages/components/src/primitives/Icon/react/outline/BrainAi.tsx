import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBrainAi = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 10a3 3 0 0 1-3-3m-3 7a3 3 0 0 1 3 3m0 3.242a4.502 4.502 0 0 0 6.827-2.503A3.501 3.501 0 0 0 19.95 12a3.5 3.5 0 0 0-2.07-5.98A4.002 4.002 0 0 0 12 3.535m0 16.707a4.502 4.502 0 0 1-6.827-2.503A3.501 3.501 0 0 1 4.05 12a3.5 3.5 0 0 1 2.07-5.98A4.002 4.002 0 0 1 12 3.535m0 16.707V3.535"
    />
  </Svg>
);
export default SvgBrainAi;
