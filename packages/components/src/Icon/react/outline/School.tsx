import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSchool = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2 19h1m19 0h-1m0 0v-8a2 2 0 0 0-2-2h-2m4 10h-4m0-10v10m0-10V7a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2m10 10h-3m-7 0V9m0 10H3m4 0h3M7 9H5a2 2 0 0 0-2 2v8m7 0v-2a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v2m-4 0h4"
    />
  </Svg>
);
export default SvgSchool;
