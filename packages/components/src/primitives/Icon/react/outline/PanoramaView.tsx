import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPanoramaView = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.043 17.993c6.095-1.81 11.82-1.81 17.914 0q.013.002.019 0a.1.1 0 0 0 .018-.007L21 17.98V6.007l-.006-.005-.017-.007a.04.04 0 0 0-.019.002c-6.121 1.794-11.795 1.794-17.916 0a.04.04 0 0 0-.019-.002.05.05 0 0 0-.023.012V17.98l.006.006a.1.1 0 0 0 .018.008q.006.001.019-.001M23 17.979c0 1.38-1.343 2.307-2.612 1.93-5.724-1.699-11.053-1.699-16.776 0C2.342 20.287 1 19.36 1 17.98V6.009c0-1.377 1.336-2.304 2.604-1.932 5.754 1.686 11.038 1.686 16.791 0C21.665 3.705 23 4.632 23 6.008z" />
  </Svg>
);
export default SvgPanoramaView;
