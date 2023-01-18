import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWalletAdd = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      d="M8.5 14a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="m2.663 4.827 7.944 2.87a3.48 3.48 0 0 1 1.71 1.235c.43.579.668 1.353.683 2.073v5.842M2.663 4.827a2.54 2.54 0 0 0-.662 1.77v9.864a3.415 3.415 0 0 0 2.4 3.192l6.199 2.27a1.895 1.895 0 0 0 2.4-2v-3.076M2.663 4.827l.035-.037A2.54 2.54 0 0 1 4.465 4H12m1 12.847h3.129A2.837 2.837 0 0 0 19 14.034V11m0-10v3m0 0v3m0-3h3m-3 0h-3"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgWalletAdd;
