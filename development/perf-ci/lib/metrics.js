function median(nums) {
  const arr = nums
    .filter((n) => Number.isFinite(n))
    .slice()
    .toSorted((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 1) return arr[mid];
  return (arr[mid - 1] + arr[mid]) / 2;
}

function countExceed(values, threshold) {
  if (!Number.isFinite(threshold)) return 0;
  return values.filter((v) => Number.isFinite(v) && v > threshold).length;
}

module.exports = {
  median,
  countExceed,
};
