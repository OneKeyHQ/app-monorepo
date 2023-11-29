import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.78 5.124A6 6 0 0 1 18 11a4 4 0 0 1 3.826 5.17M18.9 18.899 7.287 7.287a5.988 5.988 0 0 0-.961 1.758A5.001 5.001 0 0 0 7 19h11c.309 0 .61-.035.899-.101Zm0 0L21 21 3 3"
    />
  </Svg>
);
export default SvgCloudOff;
