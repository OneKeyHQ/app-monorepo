import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgExpand = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 10V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4m2-7v3m0-3h-3m3 0-3 3M9 21H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2Z"
    />
  </Svg>
);
export default SvgExpand;
