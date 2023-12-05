import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRadar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M7.5 4.5 12 12l4.5-7.5m-1.927 3.212a5 5 0 1 1-5.146 0M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0-8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
    />
  </Svg>
);
export default SvgRadar;
