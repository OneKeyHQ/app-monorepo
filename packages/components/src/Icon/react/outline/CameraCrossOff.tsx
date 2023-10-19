import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraCrossOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.998 11.5 14 15.502m.002-4.002L10 15.502M6.43 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1.43a2 2 0 0 1-1.664-.89l-.812-1.22A2 2 0 0 0 13.43 4h-2.86a2 2 0 0 0-1.664.89l-.812 1.22A2 2 0 0 1 6.43 7Z"
    />
  </Svg>
);
export default SvgCameraCrossOff;
