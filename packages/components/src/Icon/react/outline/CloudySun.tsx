import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudySun = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.051 9.36a4.001 4.001 0 1 1 7.188 2.988M11.05 9.36a6.017 6.017 0 0 1 2.885 2.228c.324.467.938.676 1.49.54a4.509 4.509 0 0 1 2.813.22M11.05 9.36A6 6 0 1 0 9 21h7.5a4.5 4.5 0 0 0 1.739-8.652M15 2.5V2m-4.951 2.55-.354-.353m10.252.353.354-.353M23 9.5h-.5"
    />
  </Svg>
);
export default SvgCloudySun;
