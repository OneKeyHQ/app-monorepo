import Svg, { SvgProps, Path } from 'react-native-svg';
const Nostr = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.5856 8.96734V18.6212C19.5856 18.9842 19.291 19.2788 18.928 19.2788H11.036C10.673 19.2788 10.3784 18.9842 10.3784 18.6212V16.8233C10.4143 14.6195 10.6475 12.5085 11.1369 11.5481C11.4304 10.9705 11.9141 10.6562 12.4697 10.488C13.5194 10.1725 15.3613 10.3882 16.143 10.3511C16.143 10.3511 18.5046 10.4451 18.5046 9.10769C18.5046 8.03131 17.4491 8.11598 17.4491 8.11598C16.2857 8.14613 15.3996 8.06726 14.8254 7.84108C13.8638 7.46295 13.8314 6.76934 13.8279 6.53736C13.7803 3.85799 9.82972 3.5367 6.34887 4.20132C2.54324 4.9251 6.39062 10.3801 6.39062 17.6619V18.6339C6.38367 18.9912 6.09485 19.28 5.73528 19.28H1.82758C1.46454 19.28 1.16992 18.9854 1.16992 18.6223V1.9256C1.16992 1.56255 1.46454 1.26794 1.82758 1.26794H5.50098C5.86403 1.26794 6.15864 1.56255 6.15864 1.9256C6.15864 2.46495 6.76527 2.76537 7.20371 2.45103C8.52484 1.50456 10.2206 1 12.1182 1C16.3692 1 19.5833 3.47754 19.5833 8.96734H19.5856ZM12.5288 7.00827C12.5288 6.23114 11.899 5.60132 11.1218 5.60132C10.3447 5.60132 9.71489 6.23114 9.71489 7.00827C9.71489 7.78541 10.3447 8.41523 11.1218 8.41523C11.899 8.41523 12.5288 7.78541 12.5288 7.00827Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default Nostr;
