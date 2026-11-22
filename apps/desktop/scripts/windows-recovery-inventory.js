/* eslint-disable onekey/no-raw-error -- standalone build script without app runtime dependencies */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const inventoryFilename = 'OneKeyInstallerInventory.dll';
const maxInventoryBytes = 8 * 1024 * 1024;

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function validateName(name) {
  if (
    !name ||
    name.length > 255 ||
    /[. ]$|[\\/:*?"<>|]/u.test(name) ||
    [...name].some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new Error(`Unsupported Windows inventory filename: ${name}`);
  }
}

async function createInventory({
  appOutDir,
  uninstallerPath,
  uninstallerFilename,
  uninstallerIconPath,
  release,
}) {
  if (!/^[0-9A-Za-z][0-9A-Za-z._+-]{0,62}$/u.test(release)) {
    throw new Error(`Invalid Windows inventory release: ${release}`);
  }
  validateName(uninstallerFilename);
  const lines = ['onekey-inventory-v2', release];
  let size = lines[0].length + release.length + 2;
  const record = (value, relative) => {
    const line = `${value}\t${relative}`;
    size += Buffer.byteLength(line) + 1;
    if (size > maxInventoryBytes)
      throw new Error('Windows inventory exceeds size limit');
    lines.push(line);
  };
  const extras = new Map([
    [uninstallerFilename.toLowerCase(), uninstallerPath],
  ]);
  if (uninstallerIconPath)
    extras.set('uninstallericon.ico', uninstallerIconPath);

  async function visit(directory, relative, depth) {
    if (depth > 64)
      throw new Error('Windows inventory directory depth exceeds limit');
    const entries = await fs.promises.readdir(directory);
    for (const filename of entries.toSorted()) {
      validateName(filename);
      const lower = filename.toLowerCase();
      if (
        !relative &&
        (lower === inventoryFilename.toLowerCase() || extras.has(lower))
      ) {
        throw new Error(
          `Windows app package already contains installer output: ${filename}`,
        );
      }
      const source = path.join(directory, filename);
      const item = await fs.promises.lstat(source);
      const name = relative ? `${relative}\\${filename}` : filename;
      if (item.isDirectory()) {
        record('d', name);
        await visit(source, name, depth + 1);
      } else if (item.isFile() && item.nlink === 1) {
        record(await sha256(source), name);
      } else {
        throw new Error(`Unsupported Windows inventory entry: ${source}`);
      }
    }
  }

  await visit(appOutDir, '', 0);
  record(await sha256(uninstallerPath), uninstallerFilename);
  if (uninstallerIconPath)
    record(await sha256(uninstallerIconPath), 'uninstallerIcon.ico');
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8');
}

function embedInventory(template, inventory) {
  // The VC linker builds a resource-only PE32 DLL with one read-only section.
  // Extend the section before signing so the signature covers every byte.
  if (template.length < 512 || template.readUInt16LE(0) !== 0x5a_4d) {
    throw new Error('Invalid Windows inventory PE template');
  }
  const nt = template.readUInt32LE(0x3c);
  const optional = nt + 24;
  const section = optional + 224;
  if (
    section + 40 > template.length ||
    template.readUInt32LE(nt) !== 0x45_50 ||
    template.readUInt16LE(nt + 4) !== 0x1_4c ||
    template.readUInt16LE(nt + 6) !== 1 ||
    template.readUInt16LE(nt + 20) !== 224 ||
    template.readUInt16LE(optional) !== 0x1_0b ||
    template.readUInt32LE(optional + 16) !== 0 ||
    template.readUInt32LE(optional + 128) !== 0 ||
    template.toString('ascii', section, section + 8) !== '.okinv\0\0'
  ) {
    throw new Error('Unexpected Windows inventory PE template');
  }
  const fileAlignment = template.readUInt32LE(optional + 36);
  const sectionAlignment = template.readUInt32LE(optional + 32);
  const headers = template.readUInt32LE(optional + 60);
  const sectionRva = template.readUInt32LE(section + 12);
  if (
    fileAlignment !== 512 ||
    sectionAlignment !== 4096 ||
    headers !== template.readUInt32LE(section + 20) ||
    headers + template.readUInt32LE(section + 16) !== template.length ||
    section + 40 > headers
  ) {
    throw new Error('Unexpected Windows inventory PE alignment');
  }
  const roundUp = (value, alignment) =>
    Math.ceil(value / alignment) * alignment;
  const rawSize = roundUp(inventory.length, fileAlignment);
  const output = Buffer.alloc(headers + rawSize);
  template.copy(output, 0, 0, headers);
  output.writeUInt32LE(rawSize, optional + 8); // SizeOfInitializedData
  output.writeUInt32LE(
    roundUp(sectionRva + inventory.length, sectionAlignment),
    optional + 56,
  );
  output.writeUInt32LE(0, optional + 64); // CheckSum
  output.fill(0, optional + 144, optional + 152); // Debug directory
  output.writeUInt32LE(inventory.length, section + 8); // VirtualSize
  output.writeUInt32LE(rawSize, section + 16); // SizeOfRawData
  inventory.copy(output, headers);
  return output;
}

async function prepareWindowsRecoveryInventory(options) {
  const [template, inventory] = await Promise.all([
    fs.promises.readFile(options.templatePath),
    createInventory(options),
  ]);
  await fs.promises.writeFile(
    options.outputPath,
    embedInventory(template, inventory),
    { flag: 'wx' },
  );
  return options.outputPath;
}

module.exports = { prepareWindowsRecoveryInventory };
