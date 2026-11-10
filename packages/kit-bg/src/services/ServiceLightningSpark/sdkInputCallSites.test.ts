import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';

import type { Node } from '@babel/types';

// The Breez SDK may only be given a BOLT11 invoice that the OneKey lightning
// service decoded, or an invoice the SDK created itself. Given anything else
// it looks the input up over the network (Lightning address, LNURL, BIP-353)
// and so contacts hosts that the input names. These are the SDK methods that
// take such input or call such a host.
const SDK_INPUT_METHODS = new Set([
  'parse',
  'prepareSendPayment',
  'prepareSendBatch',
  // The SDK's own LNURL flow. OneKey resolves an LNURL on its server, calls
  // the callback from the Lightning pages, and hands the SDK only an invoice.
  'prepareLnurlPay',
  'lnurlPay',
  'lnurlWithdraw',
  'lnurlAuth',
]);

// Every use of those methods in the Spark sources, as
// "file | enclosing function | method". A new entry needs the review a change
// to the send flow gets: state where the input comes from.
const ALLOWED_USES = [
  // The invoice the SDK just created, to read its payment hash and expiry.
  'services/ServiceLightningSpark/ServiceLightningSpark.ts | createInvoice | parse',
  // The invoice of an encodedTx, after the format check.
  'services/ServiceLightningSpark/ServiceLightningSpark.ts | prepareInvoicePayment | prepareSendPayment',
];

const KIT_BG_SRC = path.resolve(__dirname, '../..');
const SPARK_SOURCE_DIRS = [
  'services/ServiceLightningSpark',
  'vaults/impls/spark',
];

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(entryPath);
    }
    const isSource =
      /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name);
    return isSource ? [entryPath] : [];
  });
}

function getKeyName(key: Node): string {
  if (key.type === 'Identifier') {
    return key.name;
  }
  if (key.type === 'StringLiteral') {
    return key.value;
  }
  if (key.type === 'PrivateName') {
    return key.id.name;
  }
  return '<computed>';
}

function isFunctionValue(node: Node | null | undefined) {
  return (
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression'
  );
}

// The name of the function a node declares, if it declares one.
function getDeclaredFunctionName(node: Node): string | undefined {
  switch (node.type) {
    case 'ClassMethod':
    case 'ClassPrivateMethod':
    case 'ObjectMethod':
      return getKeyName(node.key);
    case 'FunctionDeclaration':
      return node.id?.name;
    case 'ClassProperty':
    case 'ObjectProperty':
      return isFunctionValue(node.value) ? getKeyName(node.key) : undefined;
    case 'VariableDeclarator':
      return isFunctionValue(node.init) ? getKeyName(node.id) : undefined;
    default:
      return undefined;
  }
}

// Any access to a watched member counts, called or not, so that passing the
// method around or binding it is found too.
function getSdkInputMethod(node: Node): string | undefined {
  if (
    node.type !== 'MemberExpression' &&
    node.type !== 'OptionalMemberExpression'
  ) {
    return undefined;
  }
  if (node.object.type === 'Identifier' && node.object.name === 'JSON') {
    return undefined;
  }
  let name: string | undefined;
  if (node.property.type === 'StringLiteral') {
    name = node.property.value;
  } else if (!node.computed && node.property.type === 'Identifier') {
    name = node.property.name;
  }
  return name !== undefined && SDK_INPUT_METHODS.has(name) ? name : undefined;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

function findSdkInputUses({
  source,
  file,
}: {
  source: string;
  file: string;
}): string[] {
  const uses: string[] = [];
  const visit = (node: Node, enclosing: string) => {
    const within = getDeclaredFunctionName(node) ?? enclosing;
    const method = getSdkInputMethod(node);
    if (method) {
      uses.push(`${file} | ${within} | ${method}`);
    }
    Object.values(node).forEach((value: unknown) => {
      (Array.isArray(value) ? value : [value]).forEach((child: unknown) => {
        if (isNode(child)) {
          visit(child, within);
        }
      });
    });
  };
  const ast = parse(source, {
    sourceFilename: file,
    sourceType: 'module',
    plugins: [
      'decorators-legacy',
      'typescript',
      ...(file.endsWith('.tsx') ? (['jsx'] as const) : []),
    ],
  });
  visit(ast.program, '<module>');
  return uses;
}

describe('Breez SDK input call sites', () => {
  it('gives the SDK outside input only at the reviewed call sites', () => {
    const uses = SPARK_SOURCE_DIRS.flatMap((dir) =>
      listSourceFiles(path.join(KIT_BG_SRC, dir)),
    ).flatMap((sourcePath) =>
      findSdkInputUses({
        source: fs.readFileSync(sourcePath, 'utf8'),
        file: path.relative(KIT_BG_SRC, sourcePath).split(path.sep).join('/'),
      }),
    );

    expect(uses.toSorted()).toEqual(ALLOWED_USES.toSorted());
  });

  it.each([
    ['async function pay(sdk) { await sdk.parse(input); }', 'pay | parse'],
    ['class A { pay() { this.sdk.lnurlPay(r); } }', 'pay | lnurlPay'],
    ['const pay = (sdk) => sdk?.lnurlAuth(r);', 'pay | lnurlAuth'],
    ["const pay = (sdk) => sdk['lnurlWithdraw'](r);", 'pay | lnurlWithdraw'],
    ['const pay = (sdk) => sdk.parse.bind(sdk);', 'pay | parse'],
    [
      'class A { pay = () => sdk.prepareLnurlPay(r); }',
      'pay | prepareLnurlPay',
    ],
    ['sdk.prepareSendBatch(r);', '<module> | prepareSendBatch'],
  ])('finds the use in %s', (source, expected) => {
    expect(findSdkInputUses({ source, file: 'a.ts' })).toEqual([
      `a.ts | ${expected}`,
    ]);
  });

  it('ignores other members and JSON.parse', () => {
    const source =
      'const f = (sdk) => { JSON.parse(text); sdk.getInfo({}); sdk.sendPayment(r); };';

    expect(findSdkInputUses({ source, file: 'a.ts' })).toEqual([]);
  });
});
