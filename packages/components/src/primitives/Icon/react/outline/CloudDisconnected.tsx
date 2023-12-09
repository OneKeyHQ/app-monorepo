import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudDisconnected = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 18.584a5.001 5.001 0 0 0-2.67-9.54c-.513.07-1.042-.166-1.306-.612A7 7 0 1 0 5 17.745M14 16l-2 2m0 0-2 2m2-2-2-2m2 2 2 2"
    />
  </Svg>
);
export default SvgCloudDisconnected;
