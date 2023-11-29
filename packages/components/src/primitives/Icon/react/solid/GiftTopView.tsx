import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGiftTopView = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 3H6a3 3 0 0 0-3 3v5h4.4c-.256-.5-.4-1.067-.4-1.667A2.333 2.333 0 0 1 9.333 7c.6 0 1.167.144 1.667.4V3ZM3 13v5a3 3 0 0 0 3 3h5v-6.16a14.111 14.111 0 0 1-2.458 2 1 1 0 1 1-1.084-1.68A12.07 12.07 0 0 0 9.98 13H3Zm10 8h5a3 3 0 0 0 3-3v-5h-6.98a12.068 12.068 0 0 0 2.522 2.16 1 1 0 0 1-1.084 1.68 14.111 14.111 0 0 1-2.458-2V21Zm8-10V6a3 3 0 0 0-3-3h-5v4.4c.5-.256 1.066-.4 1.667-.4A2.333 2.333 0 0 1 17 9.333c0 .6-.144 1.167-.4 1.667H21ZM9.333 9c.92 0 1.667.746 1.667 1.667V11h-.333C9.747 11 9 10.254 9 9.333 9 9.15 9.15 9 9.333 9ZM13 10.667V11h.333c.92 0 1.667-.746 1.667-1.667A.333.333 0 0 0 14.667 9C13.747 9 13 9.746 13 10.667Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGiftTopView;
