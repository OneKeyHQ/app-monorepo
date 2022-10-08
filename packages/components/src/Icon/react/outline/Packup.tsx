import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgPackup = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="none" {...props}>
    <Path
      d="M16.666 8.334H12.5a.833.833 0 0 1-.834-.833V3.334M3.333 11.668H7.5c.46 0 .834.373.834.833v4.167"
      stroke="#8C8CA1"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default SvgPackup;
