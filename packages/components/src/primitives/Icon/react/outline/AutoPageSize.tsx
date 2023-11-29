import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAutoPageSize = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 12h5a2 2 0 0 1 2 2v7m-7-9v7a2 2 0 0 0 2 2h5m-7-9V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"
    />
  </Svg>
);
export default SvgAutoPageSize;
