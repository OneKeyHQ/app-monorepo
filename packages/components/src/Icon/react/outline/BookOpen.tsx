import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBookOpen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8a3 3 0 0 1 3-3h5.5A1.5 1.5 0 0 1 22 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-5.223a3.64 3.64 0 0 0-1.926.522A3.663 3.663 0 0 0 12 21m0-13a3 3 0 0 0-3-3H3.5A1.5 1.5 0 0 0 2 6.5v11A1.5 1.5 0 0 0 3.5 19h5.223c.68 0 1.347.164 1.926.522S11.696 20.392 12 21m0-13v13"
    />
  </Svg>
);
export default SvgBookOpen;
