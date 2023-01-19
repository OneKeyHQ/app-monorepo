import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgInboxIn = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2m-4-1v8m0 0 3-3m-3 3L9 8m-5 5h2.586a1 1 0 0 1 .707.293l2.414 2.414a1 1 0 0 0 .707.293h3.172a1 1 0 0 0 .707-.293l2.414-2.414a1 1 0 0 1 .707-.293H20"
    />
  </Svg>
);
export default SvgInboxIn;
