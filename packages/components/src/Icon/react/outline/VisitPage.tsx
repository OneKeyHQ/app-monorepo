import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVisitPage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 12.25V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.75}
      d="M5.875 8.75a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm3.5 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm3.5 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m14.5 14.5 6.5 2-3 1.5-1.5 3-2-6.5Z"
    />
  </Svg>
);
export default SvgVisitPage;
