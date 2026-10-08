const { createFileToIdMap } = require('./moduleIdRegistry');

const fileToIdMap = createFileToIdMap();

exports.fileToIdMap = fileToIdMap;
