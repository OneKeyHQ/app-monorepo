import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCursorBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.143 12.668a1.25 1.25 0 0 1 1.525-1.525v-.001l8.485 2.233.1.03c.999.348 1.143 1.74.19 2.27l-3.708 2.06-2.06 3.707c-.53.954-1.922.81-2.27-.19l-.03-.099-2.233-8.484v-.001Zm3.69 6.172 1.259-2.264c.113-.203.282-.372.485-.485l2.263-1.258-5.438-1.43z"
      clipRule="evenodd"
    />
    <Path d="M19 3a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0V5H5v14h5a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
  </Svg>
);
export default SvgCursorBox;
