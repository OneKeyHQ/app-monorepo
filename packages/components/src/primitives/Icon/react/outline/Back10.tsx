import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBack10 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.582 9a8.003 8.003 0 0 1 14.837 0M4 5v4h4"
    />
    <Path
      fill="currentColor"
      d="M7.426 19.965V14.26H7.4l-.666.45c-.33.21-.508.273-.717.273a.7.7 0 0 1-.724-.723c0-.311.19-.59.565-.825l1.035-.692c.495-.318.945-.464 1.37-.464.743 0 1.238.502 1.238 1.276v6.411c0 .718-.374 1.117-1.034 1.117-.667 0-1.041-.406-1.041-1.117Zm3.358-3.059v-.464c0-2.583 1.326-4.265 3.46-4.265 2.138 0 3.414 1.65 3.414 4.265v.464c0 2.577-1.34 4.284-3.46 4.284s-3.414-1.669-3.414-4.284Zm2.107-.457v.45c0 1.65.495 2.616 1.333 2.616.832 0 1.333-.971 1.333-2.616v-.45c0-1.638-.501-2.597-1.34-2.597-.837 0-1.326.953-1.326 2.597Z"
    />
  </Svg>
);
export default SvgBack10;
