import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudArrowDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 18.584a5.001 5.001 0 0 0-3.561-9.335A7.002 7.002 0 0 0 2 12a6.992 6.992 0 0 0 3 5.745M12 14v6m0 0 2.5-2.5M12 20l-2.5-2.5"
    />
  </Svg>
);
export default SvgCloudArrowDown;
