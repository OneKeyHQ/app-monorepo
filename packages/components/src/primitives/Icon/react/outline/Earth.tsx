import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEarth = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m11.2 11.873 1.89.12.27.018.224.15 3.599 2.418-1.643 3.286h-4.072L8.77 13.817l1.66-1.655.32-.318zm.144 2.201 1.194 1.791h1.766l.302-.607-1.914-1.286-1.17-.074z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m1.8 6.932L9.777 9.943l-1.31 2.6-4.064-3.05a8 8 0 1 0 10.495-4.95l-1.096 4.389ZM12 4a7.99 7.99 0 0 0-6.717 3.655L7.755 9.51l.441-.874.205-.408 3.75-.944.807-3.225A8 8 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEarth;
