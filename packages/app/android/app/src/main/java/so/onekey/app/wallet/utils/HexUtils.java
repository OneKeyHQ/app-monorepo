package so.onekey.app.wallet.utils;

import java.math.BigInteger;
import java.util.Collections;

/**
 * @author liyan
 */
public class HexUtils {

  public static byte[] hexString2Bytes(String hex) {
    if (hex == null) return new byte[0];
    return String2Bytes(hex, 16);
  }

  private static byte[] String2Bytes(String str, int digit) {
    byte[] bArray = new BigInteger("10" + str, digit).toByteArray();

    byte[] ret = new byte[bArray.length - 1];
    for (int i = 0; i < ret.length; i++) {
      ret[i] = bArray[i + 1];
    }

    return ret;
  }


  public static String stringToHexString(String s) {
    if (s == null) return "";
    String str = "";
    for (int i = 0; i < s.length(); i++) {
      int ch = s.charAt(i);
      String s4 = Integer.toHexString(ch);
      str = str + s4;
    }
    return str;
  }

  /**
   * 将字节数组转换成十六进制的字符串
   *
   * @param bt    字节数组
   * @param start 起始下标
   * @param end   终止下标
   */
  public static String byteArr2HexStr(byte[] bt, int start, int end) {
    return byteArr2HexStr(bt, start, end, "");
  }

  /**
   * 将字节数组转换成十六进制的字符串
   *
   * @param bt 字节数组
   */
  public static String byteArr2HexStr(byte[] bt) {
    if (bt == null) return "";
    if (bt.length == 0) return "";
    return byteArr2HexStr(bt, 0, bt.length, "");
  }

  /**
   * 将字节数组转换成十六进制的字符串
   *
   * @param bt    字节数组
   * @param start 起始下标
   * @param end   终止下标
   * @param sep   每个字节之间的分割字符串
   */
  public static String byteArr2HexStr(byte[] bt, int start, int end, String sep) {
    if (bt == null || bt.length < end || start < 0 || start >= end) {
      throw new RuntimeException("param format error");
    }

    StringBuffer sb = new StringBuffer();
    for (int i = start; i < end; i++) {
      sb.append(byte2HexStr(bt[i])).append(sep);
    }
    return sb.toString();
  }

  /**
   * 将byte转换成对应的十六进制字符串（如：byte值0x3D转换成字符串"3D"）
   *
   * @return 返回字符串长度一定为2
   */
  public static String byte2HexStr(byte b) {
    int i = (b & 0xF0) >> 4;
    int j = (b & 0x0F);
    char c = (char) (i > 9 ? 'A' + i % 10 : '0' + i);
    char d = (char) (j > 9 ? 'A' + j % 10 : '0' + j);
    return "" + c + d;
  }
}