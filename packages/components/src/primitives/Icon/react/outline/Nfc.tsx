import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNfc = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 8a4.99 4.99 0 0 1 2 4 4.99 4.99 0 0 1-2 4l-4-2.667M5 16a4.992 4.992 0 0 1-2-4 4.989 4.989 0 0 1 2-4l4 2.667m10.18-5.303A12.94 12.94 0 0 1 21 12a12.94 12.94 0 0 1-1.82 6.636M15.953 7.784A8.96 8.96 0 0 1 17 12a8.96 8.96 0 0 1-1.046 4.215"
    />
  </Svg>
);
export default SvgNfc;
