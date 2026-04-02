import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgToast = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 3c2.622 0 5.046.588 6.85 1.59C20.62 5.573 22 7.09 22 9c0 1.47-.826 2.711-2 3.645V21H4v-8.355C2.826 11.71 2 10.47 2 9c0-1.909 1.38-3.427 3.15-4.41C6.954 3.588 9.378 3 12 3m0 2c-2.348 0-4.424.531-5.878 1.339C4.634 7.165 4 8.147 4 9c0 .736.465 1.562 1.566 2.318l.434.298V19h12v-7.384l.434-.298C19.535 10.562 20 9.736 20 9c0-.853-.634-1.835-2.122-2.661C16.424 5.53 14.348 5 12 5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgToast;
