import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h15M9.5 4h3.93a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 17.57 7H19a2 2 0 0 1 2 2v6m-10.5-4.599a3 3 0 1 0 4.099 4.099M3 3l18 18"
    />
  </Svg>
);
export default SvgCameraOff;
