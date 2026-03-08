import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFinder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m17.387 15.777-.832.555C14.98 17.382 13.534 18 12 18s-2.98-.619-4.555-1.668l-.832-.555 1.11-1.664.832.555C9.98 15.618 11.034 16 12 16s2.02-.381 3.445-1.332l.832-.555zM9 11H7V8h2zm8 0h-2V8h2z" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5h-5.536a45 45 0 0 0-1.142 7h1.928v2h-4.06l.062-1.058A46.6 46.6 0 0 1 11.409 5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFinder;
