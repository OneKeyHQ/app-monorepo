import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFeatures = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.245 1.667c.584-.97 1.99-.97 2.574 0l1.495 2.484 2.825.654a1.502 1.502 0 0 1 .795 2.449l-1.9 2.189.25 2.888a1.502 1.502 0 0 1-2.082 1.514l-2.67-1.131-2.67 1.13a1.502 1.502 0 0 1-2.082-1.513l.25-2.888-1.9-2.19a1.502 1.502 0 0 1 .795-2.448l2.825-.654zm-6.518 8.61a1 1 0 0 1 0 1.416L3.721 15.7a1.002 1.002 0 0 1-1.416-1.416l4.006-4.006a1 1 0 0 1 1.416 0Zm2.003 5.007a1 1 0 0 1 0 1.417l-4.006 4.006a1.002 1.002 0 0 1-1.416-1.417l4.006-4.006a1 1 0 0 1 1.416 0m7.01 0a1 1 0 0 1 0 1.417l-4.005 4.006a1.002 1.002 0 0 1-1.416-1.417l4.005-4.006a1 1 0 0 1 1.417 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFeatures;
