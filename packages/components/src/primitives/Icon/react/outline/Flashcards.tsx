import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFlashcards = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.108 3.155 20.54 18.073l-5.534-.582.35 3.327-11.934 1.255L1.854 7.155l7.854-.826.466-4.428zM4.052 8.935l1.15 10.939 7.955-.836-1.15-10.94zm7.69-2.819 2.046-.215 1.004 9.556 3.968.418 1.15-10.94-7.957-.836-.212 2.017Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFlashcards;
