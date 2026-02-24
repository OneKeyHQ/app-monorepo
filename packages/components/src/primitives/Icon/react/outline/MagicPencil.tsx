import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicPencil = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m14.676 5.73 6.116-2.521-2.523 6.114 4.289 5.037-6.596-.51-3.464 5.635-1.28-5.29L4 21.414 2.586 20l7.219-7.22-5.29-1.278 5.634-3.465-.508-6.595zm-2.438 3.372-2.58 1.585 2.944.711.71 2.943 1.586-2.578 3.019.232-1.962-2.305 1.154-2.8-2.799 1.156-2.305-1.964z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagicPencil;
