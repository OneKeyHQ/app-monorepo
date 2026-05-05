import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFinder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.917 3a47 47 0 0 0-1.665 9.942L10.19 14h4.06v-2h-1.928a45.5 45.5 0 0 1 1.674-9H21v18H3V3zm3.528 11.668C14.02 15.618 12.966 16 12 16s-2.02-.381-3.445-1.332l-.832-.555-1.11 1.664.832.555C9.02 17.382 10.466 18 12 18s2.98-.619 4.555-1.668l.832-.555-1.11-1.664zM7 11h2V8H7zm8 0h2V8h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFinder;
