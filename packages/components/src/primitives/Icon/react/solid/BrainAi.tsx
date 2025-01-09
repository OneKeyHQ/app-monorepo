import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBrainAi = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11 2.1a5 5 0 0 0-5.645 3.047A4.501 4.501 0 0 0 2.758 12a4.499 4.499 0 0 0 1.601 6.459A5.501 5.501 0 0 0 11 21.793V17a2 2 0 0 0-2-2 1 1 0 1 1 0-2c.729 0 1.412.195 2 .535V2.1Zm2 19.693a5.504 5.504 0 0 0 6.64-3.334A4.499 4.499 0 0 0 21.243 12a4.501 4.501 0 0 0-2.597-6.853A5.001 5.001 0 0 0 13 2.1v4.903A2 2 0 0 0 15 9a1 1 0 1 1 0 2 3.982 3.982 0 0 1-2-.535v11.328Z"
    />
  </Svg>
);
export default SvgBrainAi;
