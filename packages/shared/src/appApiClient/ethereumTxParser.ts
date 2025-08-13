import { ethers } from 'ethers';

export interface ParsedEthereumTx {
  // 基本信息
  nonce: number;
  gasPrice: string;
  gasLimit: string;
  to: string;
  value: string;
  data: string;
  
  // 签名信息
  v: number;
  r: string;
  s: string;
  
  // 计算出的信息
  from: string;
  hash: string;
  type: number;
  chainId?: number;
  
  // 解析后的数据
  isContractInteraction: boolean;
  methodSignature?: string;
  decodedData?: any;
}

export function parseEthereumTransaction(hexTx: string): ParsedEthereumTx {
  try {
    // 移除0x前缀（如果有的话）
    const cleanHex = hexTx.startsWith('0x') ? hexTx : `0x${hexTx}`;
    
    // 使用ethers解析交易
    const parsedTx = ethers.utils.parseTransaction(cleanHex);
    
    // 计算发送者地址
    const from = ethers.utils.recoverAddress(
      ethers.utils.keccak256(ethers.utils.serializeTransaction({
        ...parsedTx,
        v: parsedTx.v,
        r: parsedTx.r,
        s: parsedTx.s,
      })),
      {
        v: parsedTx.v,
        r: parsedTx.r,
        s: parsedTx.s,
      }
    );
    
    // 检查是否为合约交互
    const isContractInteraction = parsedTx.data && parsedTx.data !== '0x';
    
    // 尝试解析方法签名
    let methodSignature: string | undefined;
    let decodedData: any;
    
    if (isContractInteraction && parsedTx.data && parsedTx.data.length >= 10) {
      methodSignature = parsedTx.data.slice(0, 10);
      
      // 尝试解析常见的ERC20方法
      try {
        const erc20Interface = new ethers.utils.Interface([
          'function transfer(address to, uint256 amount)',
          'function transferFrom(address from, address to, uint256 amount)',
          'function approve(address spender, uint256 amount)',
          'function mint(address to, uint256 amount)',
          'function burn(uint256 amount)',
        ]);
        
        decodedData = erc20Interface.parseTransaction(parsedTx);
      } catch (error) {
        // 如果解析失败，保持undefined
      }
    }
    
    return {
      nonce: parsedTx.nonce,
      gasPrice: parsedTx.gasPrice?.toString() || '0',
      gasLimit: parsedTx.gasLimit?.toString() || '0',
      to: parsedTx.to || '',
      value: parsedTx.value?.toString() || '0',
      data: parsedTx.data || '0x',
      v: parsedTx.v,
      r: parsedTx.r || '',
      s: parsedTx.s || '',
      from,
      hash: parsedTx.hash || '',
      type: parsedTx.type || 0,
      chainId: parsedTx.chainId,
      isContractInteraction,
      methodSignature,
      decodedData,
    };
  } catch (error) {
    throw new Error(`Failed to parse Ethereum transaction: ${error.message}`);
  }
}

export function formatEthereumValue(value: string, decimals: number = 18): string {
  try {
    const bigNumber = ethers.BigNumber.from(value);
    return ethers.utils.formatUnits(bigNumber, decimals);
  } catch (error) {
    return value;
  }
}

export function getMethodName(methodSignature: string): string {
  const commonMethods: Record<string, string> = {
    '0xa9059cbb': 'transfer(address,uint256)',
    '0x23b872dd': 'transferFrom(address,address,uint256)',
    '0x095ea7b3': 'approve(address,uint256)',
    '0x40c10f19': 'mint(address,uint256)',
    '0x42966c68': 'burn(uint256)',
    '0x40c10f19': 'mint(address,uint256)',
    '0x18160ddd': 'totalSupply()',
    '0x70a08231': 'balanceOf(address)',
    '0x313ce567': 'decimals()',
    '0x95d89b41': 'symbol()',
    '0x06fdde03': 'name()',
  };
  
  return commonMethods[methodSignature] || `Unknown method (${methodSignature})`;
}

export function analyzeTransaction(hexTx: string): string {
  try {
    const parsed = parseEthereumTransaction(hexTx);
    
    let analysis = '=== 以太坊交易解析结果 ===\n\n';
    
    // 基本信息
    analysis += `📋 基本信息:\n`;
    analysis += `   Nonce: ${parsed.nonce}\n`;
    analysis += `   Gas Price: ${ethers.utils.formatUnits(parsed.gasPrice, 'gwei')} Gwei\n`;
    analysis += `   Gas Limit: ${parsed.gasLimit}\n`;
    analysis += `   发送方: ${parsed.from}\n`;
    analysis += `   接收方: ${parsed.to}\n`;
    analysis += `   交易金额: ${ethers.utils.formatEther(parsed.value)} ETH\n`;
    analysis += `   交易类型: ${parsed.type === 0 ? 'Legacy' : 'EIP-1559'}\n`;
    if (parsed.chainId) {
      analysis += `   链ID: ${parsed.chainId}\n`;
    }
    
    // 签名信息
    analysis += `\n🔐 签名信息:\n`;
    analysis += `   V: ${parsed.v}\n`;
    analysis += `   R: ${parsed.r}\n`;
    analysis += `   S: ${parsed.s}\n`;
    
    // 交易哈希
    analysis += `\n🔗 交易哈希:\n`;
    analysis += `   ${parsed.hash}\n`;
    
    // 合约交互分析
    if (parsed.isContractInteraction) {
      analysis += `\n📜 合约交互:\n`;
      analysis += `   是否为合约交互: 是\n`;
      if (parsed.methodSignature) {
        analysis += `   方法签名: ${parsed.methodSignature}\n`;
        analysis += `   方法名称: ${getMethodName(parsed.methodSignature)}\n`;
      }
      
      if (parsed.decodedData) {
        analysis += `   解析后的参数:\n`;
        analysis += `     方法: ${parsed.decodedData.name}\n`;
        if (parsed.decodedData.args) {
          parsed.decodedData.args.forEach((arg: any, index: number) => {
            analysis += `     参数${index + 1}: ${arg}\n`;
          });
        }
      }
      
      analysis += `   原始数据: ${parsed.data}\n`;
    } else {
      analysis += `\n📜 合约交互:\n`;
      analysis += `   是否为合约交互: 否 (普通转账)\n`;
    }
    
    return analysis;
  } catch (error) {
    return `❌ 解析失败: ${error.message}`;
  }
} 