import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgToast = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 12.143c1.25-.859 2-1.952 2-3.143 0-2.761-4.03-5-9-5S3 6.239 3 9c0 1.19.75 2.284 2 3.143V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.857Z"
    />
  </Svg>
);
export default SvgToast;
