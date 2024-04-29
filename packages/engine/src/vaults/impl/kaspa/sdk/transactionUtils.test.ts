import BigNumber from 'bignumber.js';

import {
  calculateTxFee,
  convertInputUtxos,
  convertOutputUtxos,
  determineFromAddress,
  determineToAddresses,
} from './transactionUtils';

jest.setTimeout(3 * 60 * 1000);

function generateInput(address: string, amount: bigint) {
  return {
    'id': 110626207,
    'transaction_id':
      '307152df3272499213432dac3c81b17004c7afd81eecd6994a28dba982a5d60e',
    'index': 0,
    'previous_outpoint_hash':
      '313d1137f5a06d1e5bbb725d71d1c2bff2680463cdf3df6adb29ee30cb8193b5',
    'previous_outpoint_index': '0',
    'previous_outpoint_resolved': null,
    'previous_outpoint_address': address,
    'previous_outpoint_amount': amount,
    'signature_script':
      '41967e13610a58f6e26ad91a3df70dd8d3b7e0a67a8220a7838d8cfe7e1263ddaa1b18cbf67268f15784886cec23f89e948ce4a01952daaa51f45a1a147e3628f901',
    'sig_op_count': '1',
  };
}

function generateOutput(address: string, amount: bigint) {
  return {
    'id': 216112275,
    'transaction_id':
      '54fa2d46e00aa9755567c00d4061fc2a8b2b96e8393aec8a374367918a9d215b',
    'index': 0,
    'amount': amount,
    'script_public_key':
      '20a2680c1cb297e08d96eee95da2f11f35c341f0c21a029fe0fbee951aef388278ac',
    'script_public_key_address': address,
    'script_public_key_type': 'pubkey',
    'accepting_block_hash': null,
  };
}

const cases = [
  {
    testId: 'normal-transfer-with-change',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
      inputs: [
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          100000n,
        ),
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          89993516n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          100000n,
        ),
        generateOutput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          89989974n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
      toAddress: [
        {
          address:
            'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          amount: 100000n,
        },
      ],
      fee: new BigNumber('0.00003542'),
    },
  },
  {
    testId: 'test-mining—bonus',
    data: {
      mass: '0',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [],
      outputs: [
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          13859131548n,
        ),
      ],
    },
    result: {
      fromAddress: 'kaspa:00000000',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 13859131548n,
        },
      ],

      fee: new BigNumber('0'),
    },
  },
  {
    testId: 'test-self-to-self-single',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          100000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          96847n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 96847n,
        },
      ],
      fee: new BigNumber('0.00003153'),
    },
  },
  {
    testId: 'test-self-to-self-multiple',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          100000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          100000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          96847n,
        ),
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          100000n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 196847n,
        },
      ],
      fee: new BigNumber('0.00003153'),
    },
  },
  {
    testId: 'test-self-to-other',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          100000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          96846n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      toAddress: [
        {
          address:
            'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          amount: 96846n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-self-to-other-with-change',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          100000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          10000n,
        ),
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          86846n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      toAddress: [
        {
          address:
            'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          amount: 10000n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-self-to-multi-other',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          100000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          10000n,
        ),
        generateOutput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          86846n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      toAddress: [
        {
          address:
            'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          amount: 10000n,
        },
        {
          address:
            'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          amount: 86846n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-self-to-multi-other-with-change',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          100000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          10000n,
        ),
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          36846n,
        ),
        generateOutput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          50000n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      toAddress: [
        {
          address:
            'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          amount: 10000n,
        },
        {
          address:
            'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          amount: 50000n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-multi-self-to-self',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          46846n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 46846n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-multi-other&self-to-self-with-change',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          36846n,
        ),
        generateOutput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 36846n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-multi-other&self-to-self',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
        generateInput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          46846n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 46846n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-other-to-self',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          16846n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 16846n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-other-to-self-with-change',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          6846n,
        ),
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 10000n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-other-to-multi-self',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          6846n,
        ),
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          10000n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 16846n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-other-to-multi-self-with-change',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          6846n,
        ),
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          5000n,
        ),
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          5000n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 10000n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-other-to-multi-self-and-other',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          5000n,
        ),
        generateOutput(
          'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          5000n,
        ),
        generateOutput(
          'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          6846n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 5000n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
  {
    testId: 'test-other-to-multi-self-and-other-with-change',
    data: {
      mass: '3154',
      mineAddress:
        'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
      inputs: [
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
        generateInput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          10000n,
        ),
      ],
      outputs: [
        generateOutput(
          'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
          6846n,
        ),
        generateOutput(
          'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          5000n,
        ),
        generateOutput(
          'kaspa:qpw28f6nq2zwt30ywf2yahtqqtp6l6uv37zd8fegltf9tfy8yaflk4fvlp8mp',
          5000n,
        ),
      ],
    },
    result: {
      fromAddress:
        'kaspa:qpa0mtj40e5uqpq06sf44hluvru5smajraxt4c3nl4km86zt537929zjp27tu',
      toAddress: [
        {
          address:
            'kaspa:qz3xsrquk2t7prvkam54mgh3ru6uxs0scgdq98lql0hf2xh08zp8shclpaz4e',
          amount: 5000n,
        },
      ],
      fee: new BigNumber('0.00003154'),
    },
  },
];

describe('test kaspa tx decode', () => {
  cases.forEach((f) => {
    test(f.testId, () => {
      const {
        data: { mass, mineAddress, inputs, outputs },
        result: { fromAddress, toAddress, fee },
      } = f;

      const hasSenderIncludeMine = inputs?.some(
        (input) => input.previous_outpoint_address === mineAddress,
      );
      const hasReceiverIncludeMine = outputs?.some(
        (output) => output.script_public_key_address === mineAddress,
      );

      const token = {
        id: '',
        name: '',
        decimals: 8,
        symbol: 'KAS',
        networkId: '',
        tokenIdOnNetwork: '',
        logoURI: '',
      };

      convertInputUtxos(inputs, mineAddress, token);
      const utxoTo = convertOutputUtxos(outputs, mineAddress, token);

      const fromAddressResult = determineFromAddress(
        mineAddress,
        hasSenderIncludeMine,
        hasReceiverIncludeMine,
        inputs,
      );
      const toAddressesResult = determineToAddresses(
        mineAddress,
        hasSenderIncludeMine,
        hasReceiverIncludeMine,
        outputs,
        inputs,
      );

      const feeResult = calculateTxFee({
        mass,
        inputs,
        outputs,
        decimals: token.decimals,
      });

      expect(fromAddressResult).toBe(fromAddress);
      expect(toAddressesResult).toEqual(toAddress.map((add) => add.address));
      expect(feeResult).toEqual(fee.toFixed());

      toAddress.forEach(({ address, amount }) => {
        const totalAmountValue = utxoTo
          .filter((utxo) => utxo.address === address)
          .reduce(
            (sum, utxo) => sum.plus(new BigNumber(utxo.balanceValue)),
            new BigNumber(0),
          );
        expect(BigInt(totalAmountValue.toFixed())).toEqual(amount);
      });
    });
  });
});

export {};
