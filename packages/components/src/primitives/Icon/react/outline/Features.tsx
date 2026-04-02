import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFeatures = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.414 16 5 21.414 3.586 20 9 14.586zm7 0L12 21.414 10.586 20 16 14.586zm-9-5L3 16.414 1.586 15 7 9.586z" />
    <Path
      fillRule="evenodd"
      d="m18.113 4.403 4.938 1.144-3.323 3.826.439 5.05-4.667-1.978-4.667 1.978.438-5.049L7.95 5.547l4.937-1.144L15.5.061zm-3.95 1.757-2.525.585 1.422 1.638.277.32-.036.422-.188 2.16 2.387-1.01 2.386 1.01-.223-2.582.277-.32 1.421-1.638-2.524-.585L15.5 3.938z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFeatures;
