import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCustomerSupport = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M10.083 16.667h.685A4.232 4.232 0 0 0 15 12.434v0-4.101a5 5 0 0 0-5-5v0a5 5 0 0 0-5 5v4.101M3.667 13.5H5V9.333H3.667a2 2 0 0 0-2 2v.167a2 2 0 0 0 2 2Z"
      stroke="#8C8CA1"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9.333 16.667h1.334"
      stroke="#8C8CA1"
      strokeWidth={3.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M16.333 9.333H15V13.5h1.333a2 2 0 0 0 2-2v-.167a2 2 0 0 0-2-2Z"
      stroke="#8C8CA1"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgCustomerSupport;
