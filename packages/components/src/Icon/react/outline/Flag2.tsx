import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFlag2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15V4.62c0-.38.214-.726.566-.868C6.303 3.456 7.656 3 9 3c1.991 0 4.009 2 6 2 .888 0 1.78-.199 2.495-.42.71-.218 1.505.292 1.505 1.035v8.766a.92.92 0 0 1-.566.867c-.737.296-2.09.752-3.434.752-1.991 0-4.009-2-6-2-1.991 0-4 1-4 1Zm0 0v6"
    />
  </Svg>
);
export default SvgFlag2;
