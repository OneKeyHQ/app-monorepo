import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgClouds = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.051 7.36a4.001 4.001 0 1 1 7.188 2.988M11.05 7.36a6.017 6.017 0 0 1 2.885 2.228c.324.467.938.676 1.49.54a4.509 4.509 0 0 1 2.813.22M11.05 7.36A6 6 0 1 0 9 19h7.5a4.5 4.5 0 0 0 1.739-8.652"
    />
  </Svg>
);
export default SvgClouds;
