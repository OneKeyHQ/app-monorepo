const fs = require('fs');
const path = require('path');

function getImageFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    // eslint-disable-next-line no-param-reassign
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);

    if (stat && stat.isDirectory() && path.basename(file) !== 'node_modules') {
      results = results.concat(getImageFiles(file));
    } else if (
      stat &&
      stat.isFile() &&
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file)
    ) {
      results.push({
        path: file,
        size: stat.size,
      });
    }
  });

  return results;
}

const imageFiles = getImageFiles(process.cwd());
imageFiles.sort((a, b) => b.size - a.size);

let totalSize = 0;
console.log('| 文件路径 | 文件大小 |');
console.log('|----------|----------|');
imageFiles.forEach((file) => {
  console.log(
    `| ${path.relative(process.cwd(), file.path)} | ${(
      file.size / 1024
    ).toFixed(2)} KB |`,
  );
  totalSize += file.size;
});

console.log('\n总大小:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
