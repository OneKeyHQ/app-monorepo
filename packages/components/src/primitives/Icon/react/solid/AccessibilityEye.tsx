import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAccessibilityEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.707 2.293a1 1 0 0 0-1.414 1.414L5.11 6.522a14 14 0 0 0-1.873 1.826 16.5 16.5 0 0 0-1.866 2.711 1.94 1.94 0 0 0 0 1.883c2.991 5.39 7.903 7.803 12.646 6.859a11 11 0 0 0 3.187-1.184l3.09 3.09a1 1 0 0 0 1.415-1.414l-2.816-2.815c1.422-1.14 2.696-2.657 3.738-4.533a1.95 1.95 0 0 0 0-1.89C20.067 6.44 16.097 4 12.002 4c-1.795 0-3.566.468-5.204 1.383l-3.09-3.09Zm6.629 6.628 4.745 4.745a3.5 3.5 0 0 0-4.745-4.745m-4.955.045q.559-.564 1.152-1.02l9.187 9.188a9 9 0 0 1-1.585.587zm-1.294 1.535 7.487 7.487C8.46 17.825 5.309 15.898 3.135 12q.45-.806.952-1.499"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAccessibilityEye;
