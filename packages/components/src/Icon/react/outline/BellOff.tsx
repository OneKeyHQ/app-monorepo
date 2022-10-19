import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBellOff = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="m18.364 18.364-.707.707.707-.707Zm-2.829-2.829-.707.708.708-.707ZM3.708 2.293a1 1 0 0 0-1.414 1.414l1.414-1.414Zm9 10.414.707-.707-.707.707Zm7.586 9a1 1 0 0 0 1.414-1.414l-1.414 1.414Zm-18-18L10.586 12 12 10.586 3.707 2.293 2.293 3.707ZM10.586 12 12 13.414 13.414 12 12 10.586 10.586 12ZM12 13.414l2.828 2.829 1.415-1.415L13.414 12 12 13.414Zm2.828 2.829 2.829 2.828 1.414-1.414-2.828-2.829-1.415 1.415Zm2.829 2.828 2.636 2.636 1.414-1.414-2.636-2.636-1.414 1.414Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgBellOff;
