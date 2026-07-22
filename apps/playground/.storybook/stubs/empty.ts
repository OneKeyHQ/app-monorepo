// Empty module used to alias-away native-only packages that have no web
// counterpart (mirrors `react-native-aes-crypto: false` etc. in the rspack
// web resolve). Vite aliases can't map to `false`, so they point here instead.
export default {};
