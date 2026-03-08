import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBubbleAnnotation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 3c3.065 0 5.69.791 7.567 2.356C21.467 6.94 22.5 9.233 22.5 12s-1.033 5.06-2.933 6.644C17.69 20.209 15.065 21 12 21c-1.62 0-3.443-.15-5.085-.862a7 7 0 0 1-1.12.504c-.95.33-2.337.563-3.724-.094L.96 20.02l.744-.981c.688-.908.905-1.612.965-2.063a1.8 1.8 0 0 0-.016-.647l-.015-.06-.001-.001-.002-.005-.008-.018-.013-.03a22 22 0 0 1-.601-1.638C1.768 13.818 1.5 12.817 1.5 12c0-2.767 1.033-5.06 2.933-6.644C6.31 3.791 8.936 3 12 3m-4.501 7.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBubbleAnnotation;
