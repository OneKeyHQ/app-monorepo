package so.onekey.app.wallet;

import org.bouncycastle.bcpg.ArmoredInputStream;
import org.bouncycastle.openpgp.PGPPublicKey;
import org.bouncycastle.openpgp.PGPPublicKeyRingCollection;
import org.bouncycastle.openpgp.PGPSignature;
import org.bouncycastle.openpgp.PGPSignatureGenerator;
import org.bouncycastle.openpgp.PGPSignatureList;
import org.bouncycastle.openpgp.jcajce.JcaPGPObjectFactory;
import org.bouncycastle.openpgp.operator.jcajce.JcaKeyFingerprintCalculator;
import org.bouncycastle.openpgp.operator.jcajce.JcaPGPContentVerifierBuilderProvider;
import org.bouncycastle.util.Strings;
import org.bouncycastle.openpgp.PGPUtil;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.Provider;
import java.security.Security;
import java.security.SignatureException;

import org.bouncycastle.jce.provider.BouncyCastleProvider;

public class Verification {
    private static final void setupBouncyCastle() {
        final Provider provider = Security.getProvider(BouncyCastleProvider.PROVIDER_NAME);
        if (provider == null) {
            // Web3j will set up the provider lazily when it's first used.
            return;
        }
        if (provider.getClass().equals(BouncyCastleProvider.class)) {
            // BC with same package name, shouldn't happen in real life.
            return;
        }
        // Android registers its own BC provider. As it might be outdated and might not include
        // all needed ciphers, we substitute it with a known BC bundled in the app.
        // Android's BC has its package rewritten to "com.android.org.bouncycastle" and because
        // of that it's possible to have another BC implementation loaded in VM.
        Security.removeProvider(BouncyCastleProvider.PROVIDER_NAME);
        Security.insertProviderAt(new BouncyCastleProvider(), 1);
    }

    private static final String PUBLIC_KEY = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n" +
            "\n" +
            "mQINBGJATGwBEADL1K7b8dzYYzlSsvAGiA8mz042pygB7AAh/uFUycpNQdSzuoDE\n" +
            "VoXq/QsXCOsGkMdFLwlUjarRaxFX6RTV6S51LOlJFRsyGwXiMz08GSNagSafQ0YL\n" +
            "Gi+aoemPh6Ta5jWgYGIUWXavkjJciJYw43ACMdVmIWos94bA41Xm93dq9C3VRpl+\n" +
            "EjvGAKRUMxJbH8r13TPzPmfN4vdrHLq+us7eKGJpwV/VtD9vVHAi0n48wGRq7DQw\n" +
            "IUDU2mKy3wmjwS38vIIu4yQyeUdl4EqwkCmGzWc7Cv2HlOG6rLcUdTAOMNBBX1IQ\n" +
            "iHKg9Bhh96MXYvBhEL7XHJ96S3+gTHw/LtrccBM+eiDJVHPZn+lw2HqX994DueLV\n" +
            "tAFDS+qf3ieX901IC97PTHsX6ztn9YZQtSGBJO3lEMBdC4ez2B7zUv4bgyfU+KvE\n" +
            "zHFIK9HmDehx3LoDAYc66nhZXyasiu6qGPzuxXu8/4qTY8MnhXJRBkbWz5P84fx1\n" +
            "/Db5WETLE72on11XLreFWmlJnEWN4UOARrNn1Zxbwl+uxlSJyM+2GTl4yoccG+WR\n" +
            "uOUCmRXTgduHxejPGI1PfsNmFpVefAWBDO7SdnwZb1oUP3AFmhH5CD1GnmLnET+l\n" +
            "/c+7XfFLwgSUVSADBdO3GVS4Cr9ux4nIrHGJCrrroFfM2yvG8AtUVr16PQARAQAB\n" +
            "tCJvbmVrZXlocSBkZXZlbG9wZXIgPGRldkBvbmVrZXkuc28+iQJUBBMBCAA+FiEE\n" +
            "62iuVE8f3YzSZGJPs2mmepC/OHsFAmJATGwCGwMFCQeGH0QFCwkIBwIGFQoJCAsC\n" +
            "BBYCAwECHgECF4AACgkQs2mmepC/OHtgvg//bsWFMln08ZJjf5od/buJua7XYb3L\n" +
            "jWq1H5rdjJva5TP1UuQaDULuCuPqllxb+h+RB7g52yRG/1nCIrpTfveYOVtq/mYE\n" +
            "D12KYAycDwanbmtoUp25gcKqCrlNeSE1EXmPlBzyiNzxJutE1DGlvbY3rbuNZLQi\n" +
            "UTFBG3hk6JgsaXkFCwSmF95uATAaItv8aw6eY7RWv47rXhQch6PBMCir4+a/v7vs\n" +
            "lXxQtcpCqfLtjrloq7wvmD423yJVsUGNEa7/BrwFz6/GP6HrUZc6JgvrieuiBE4n\n" +
            "ttXQFm3dkOfD+67MLMO3dd7nPhxtjVEGi+43UH3/cdtmU4JFX3pyCQpKIlXTEGp2\n" +
            "wqim561auKsRb1B64qroCwT7aACwH0ZTgQS8rPifG3QM8ta9QheuOsjHLlqjo8jI\n" +
            "fpqe0vKYUlT092joT0o6nT2MzmLmHUW0kDqD9p6JEJEZUZpqcSRE84eMTFNyu966\n" +
            "xy/rjN2SMJTFzkNXPkwXYrMYoahGez1oZfLzV6SQ0+blNc3aATt9aQW6uaCZtMw1\n" +
            "ibcfWW9neHVpRtTlMYCoa2reGaBGCv0Nd8pMcyFUQkVaes5cQHkh3r5Dba+YrVvp\n" +
            "l4P8HMbN8/LqAv7eBfj3ylPa/8eEPWVifcum2Y9TqherN1C2JDqWIpH4EsApek3k\n" +
            "NMK6q0lPxXjZ3Pa5Ag0EYkBMbAEQAM1R4N3bBkwKkHeYwsQASevUkHwY4eg6Ncgp\n" +
            "f9NbmJHcEioqXTIv0nHCQbos3P2NhXvDowj4JFkK/ZbpP9yo0p7TI4fckseVSWwI\n" +
            "tiF9l/8OmXvYZMtw3hHcUUZVdJnk0xrqT6ni6hyRFIfbqous6/vpqi0GG7nB/+lU\n" +
            "E5StGN8696ZWRyAX9MmwoRoods3ShNJP0+GCYHfIcG0XRhEDMJph+7mWPlkQUcza\n" +
            "4aEjxOQ4Stwwp+ZL1rXSlyJIPk1S9/FIS/Uw5GgqFJXIf5n+SCVtUZ8lGedEWwe4\n" +
            "wXsoPFxxOc2Gqw5r4TrJFdgA3MptYebXmb2LGMssXQTM1AQS2LdpnWw44+X1CHvQ\n" +
            "0m4pEw/g2OgeoJPBurVUnu2mU/M+ARZiS4ceAR0pLZN7Yq48p1wr6EOBQdA3Usby\n" +
            "uc17MORG/IjRmjz4SK/luQLXjN+0jwQSoM1kcIHoRk37B8feHjVufJDKlqtw83H1\n" +
            "uNu6lGwb8MxDgTuuHloDijCDQsn6m7ZKU1qqLDGtdvCUY2ovzuOUS9vv6MAhR86J\n" +
            "kqoU3sOBMeQhnBaTNKU0IjT4M+ERCWQ7MewlzXuPHgyb4xow1SKZny+f+fYXPy9+\n" +
            "hx4/j5xaKrZKdq5zIo+GRGe4lA088l253nGeLgSnXsbSxqADqKK73d7BXLCVEZHx\n" +
            "f4Sa5JN7ABEBAAGJAjwEGAEIACYWIQTraK5UTx/djNJkYk+zaaZ6kL84ewUCYkBM\n" +
            "bAIbDAUJB4YfRAAKCRCzaaZ6kL84e0UGD/4mVWyGoQC86TyPoU4Pb5r8mynXWmiH\n" +
            "ZGKu2ll8qn3l5Q67OophgbA1I0GTBFsYK2f91ahgs7FEsLrmz/25E8ybcdJipITE\n" +
            "6869nyE1b37jVb3z3BJLYS/4MaNvugNz4VjMHWVAL52glXLN+SJBSNscmWZDKnVn\n" +
            "Rnrn+kBEvOWZgLbi4MpPiNVwm2PGnrtPzudTcg/NS3HOcmJTfG3mrnwwNJybTVAx\n" +
            "txlQPoXUpJQqJjtkPPW+CqosolpRdugQ5zpFSg05iL+vN+CMrVPkk85w87dtsidl\n" +
            "yZl/ZNITrLzym9d2UFVQZY2rRohNdRfx3l4rfXJFLaqQtihRvBIiMKTbUb2V0pd3\n" +
            "rVLz2Ck3gJqPfPEEmCWS0Nx6rME8m0sOkNyMau3dMUUAs4j2c3pOQmsZRjKo7LAc\n" +
            "7/GahKFhZ2aBCQzvcTES+gPH1Z5HnivkcnUF2gnQV9x7UOr1Q/euKJsxPl5CCZtM\n" +
            "N9GFW10cDxFo7cO5Ch+/BkkkfebuI/4Wa1SQTzawsxTx4eikKwcemgfDsyIqRs2W\n" +
            "62PBrqCzs9Tg19l35sCdmvYsvMadrYFXukHXiUKEpwJMdTLAtjJ+AX84YLwuHi3+\n" +
            "qZ5okRCqZH+QpSojSScT9H5ze4ZpuP0d8pKycxb8M2RfYdyOtT/eqsZ/1EQPg7kq\n" +
            "P2Q5dClenjjjVA==\n" +
            "=F0np\n" +
            "-----END PGP PUBLIC KEY BLOCK-----";
    private static int readInputLine(ByteArrayOutputStream bOut, InputStream fIn)
            throws IOException
    {
        bOut.reset();

        int lookAhead = -1;
        int ch;

        while ((ch = fIn.read()) >= 0)
        {
            bOut.write(ch);
            if (ch == '\r' || ch == '\n')
            {
                lookAhead = readPassedEOL(bOut, ch, fIn);
                break;
            }
        }

        return lookAhead;
    }

    private static int readInputLine(ByteArrayOutputStream bOut, int lookAhead, InputStream fIn)
            throws IOException
    {
        bOut.reset();

        int ch = lookAhead;

        do
        {
            bOut.write(ch);
            if (ch == '\r' || ch == '\n')
            {
                lookAhead = readPassedEOL(bOut, ch, fIn);
                break;
            }
        }
        while ((ch = fIn.read()) >= 0);

        if (ch < 0)
        {
            lookAhead = -1;
        }

        return lookAhead;
    }

    private static int readPassedEOL(ByteArrayOutputStream bOut, int lastCh, InputStream fIn)
            throws IOException
    {
        int lookAhead = fIn.read();

        if (lastCh == '\r' && lookAhead == '\n')
        {
            bOut.write(lookAhead);
            lookAhead = fIn.read();
        }

        return lookAhead;
    }

    /*
     * verify a clear text signed file
     */
    private static boolean verifyFile(
            InputStream        in,
            InputStream        keyIn,
            String             resultName
    )
            throws Exception
    {
        ArmoredInputStream    aIn = new ArmoredInputStream(in);
        OutputStream          out = new BufferedOutputStream(new FileOutputStream(resultName));



        //
        // write out signed section using the local line separator.
        // note: trailing white space needs to be removed from the end of
        // each line RFC 4880 Section 7.1
        //
        ByteArrayOutputStream lineOut = new ByteArrayOutputStream();
        int                   lookAhead = readInputLine(lineOut, aIn);
        byte[]                lineSep = getLineSeparator();

        if (lookAhead != -1 && aIn.isClearText())
        {
            byte[] line = lineOut.toByteArray();
            out.write(line, 0, getLengthWithoutSeparatorOrTrailingWhitespace(line));
            out.write(lineSep);

            while (lookAhead != -1 && aIn.isClearText())
            {
                lookAhead = readInputLine(lineOut, lookAhead, aIn);

                line = lineOut.toByteArray();
                out.write(line, 0, getLengthWithoutSeparatorOrTrailingWhitespace(line));
                out.write(lineSep);
            }
        }
        else
        {
            // a single line file
            if (lookAhead != -1)
            {
                byte[] line = lineOut.toByteArray();
                out.write(line, 0, getLengthWithoutSeparatorOrTrailingWhitespace(line));
                out.write(lineSep);
            }
        }

        out.close();

        PGPPublicKeyRingCollection pgpRings = new PGPPublicKeyRingCollection(keyIn, new JcaKeyFingerprintCalculator());

        JcaPGPObjectFactory           pgpFact = new JcaPGPObjectFactory(aIn);
        PGPSignatureList           p3 = (PGPSignatureList)pgpFact.nextObject();
        PGPSignature               sig = p3.get(0);
        PGPPublicKey publicKey = pgpRings.getPublicKey(sig.getKeyID());
        setupBouncyCastle();
        sig.init(new JcaPGPContentVerifierBuilderProvider().setProvider("BC"), publicKey);

        //
        // read the input, making sure we ignore the last newline.
        //

        InputStream sigIn = new BufferedInputStream(new FileInputStream(resultName));

        lookAhead = readInputLine(lineOut, sigIn);

        processLine(sig, lineOut.toByteArray());

        if (lookAhead != -1)
        {
            do
            {
                lookAhead = readInputLine(lineOut, lookAhead, sigIn);

                sig.update((byte)'\r');
                sig.update((byte)'\n');

                processLine(sig, lineOut.toByteArray());
            }
            while (lookAhead != -1);
        }

        sigIn.close();

        boolean isVerified = sig.verify();
        return isVerified;
    }

    private static byte[] getLineSeparator()
    {
        String nl = Strings.lineSeparator();
        byte[] nlBytes = new byte[nl.length()];

        for (int i = 0; i != nlBytes.length; i++)
        {
            nlBytes[i] = (byte)nl.charAt(i);
        }

        return nlBytes;
    }

    private static void processLine(PGPSignature sig, byte[] line)
            throws SignatureException, IOException
    {
        int length = getLengthWithoutWhiteSpace(line);
        if (length > 0)
        {
            sig.update(line, 0, length);
        }
    }

    private static void processLine(OutputStream aOut, PGPSignatureGenerator sGen, byte[] line)
            throws SignatureException, IOException
    {
        // note: trailing white space needs to be removed from the end of
        // each line for signature calculation RFC 4880 Section 7.1
        int length = getLengthWithoutWhiteSpace(line);
        if (length > 0)
        {
            sGen.update(line, 0, length);
        }

        aOut.write(line, 0, line.length);
    }

    private static int getLengthWithoutSeparatorOrTrailingWhitespace(byte[] line)
    {
        int    end = line.length - 1;

        while (end >= 0 && isWhiteSpace(line[end]))
        {
            end--;
        }

        return end + 1;
    }

    private static boolean isLineEnding(byte b)
    {
        return b == '\r' || b == '\n';
    }

    private static int getLengthWithoutWhiteSpace(byte[] line)
    {
        int    end = line.length - 1;

        while (end >= 0 && isWhiteSpace(line[end]))
        {
            end--;
        }

        return end + 1;
    }

    private static boolean isWhiteSpace(byte b)
    {
        return isLineEnding(b) || b == '\t' || b == ' ';
    }

    public static String extractedTextContentFromVerifyAscFile(String ascFileContent, String cacheFilePath) throws Exception {
        InputStream  keyIn = PGPUtil.getDecoderStream(new ByteArrayInputStream(PUBLIC_KEY.getBytes()));
        InputStream in = new ByteArrayInputStream(ascFileContent.getBytes());
        boolean isVerified = verifyFile(in, keyIn, cacheFilePath);
        if (!isVerified) {
            return "";
        }
        ArmoredInputStream ascFileContentIn = new ArmoredInputStream(new ByteArrayInputStream(ascFileContent.getBytes()));
        ByteArrayOutputStream bOut = new ByteArrayOutputStream();
        int ch;

        while ((ch = ascFileContentIn.read()) >= 0 && ascFileContentIn.isClearText())
        {
            bOut.write((byte)ch);
        }
        ascFileContentIn.close();
        // Filter out lines that start with "Hash:" (similar to desktop implementation)
        return bOut.toString();
    }

    public static String extractedSha256FromVerifyAscFile(String ascFileContent, String cacheFilePath) throws Exception {
        String extractedTextContent = extractedTextContentFromVerifyAscFile(ascFileContent, cacheFilePath);
        String extractedSha256 = extractedTextContent.split(" ")[0];
        return extractedSha256;
    }

    public static boolean testExtractedSha256FromVerifyAscFile(String cacheFilePath) throws Exception {
        String ascFileContent = "-----BEGIN PGP SIGNED MESSAGE-----\n" +
                "Hash: SHA256\n" +
                "\n" +
                "{\n" +
                "  \"fileName\": \"metadata.json\",\n" +
                "  \"sha256\": \"2ada9c871104fc40649fa3de67a7d8e33faadc18e9abd587e8bb85be0a003eba\",\n" +
                "  \"size\": 158590,\n" +
                "  \"generatedAt\": \"2025-09-19T07:49:13.000Z\"\n" +
                "}\n" +
                "-----BEGIN PGP SIGNATURE-----\n" +
                "\n" +
                "iQJCBAEBCAAsFiEE62iuVE8f3YzSZGJPs2mmepC/OHsFAmjNJ1IOHGRldkBvbmVr\n" +
                "ZXkuc28ACgkQs2mmepC/OHs6Rw/9FKHl5aNsE7V0IsFf/l+h16BYKFwVsL69alMk\n" +
                "CFLna8oUn0+tyECF6wKBKw5pHo5YR27o2pJfYbAER6dygDF6WTZ1lZdf5QcBMjGA\n" +
                "LCeXC0hzUBzSSOH4bKBTa3fHp//HdSV1F2OnkymbXqYN7WXvuQPLZ0nV6aU88hCk\n" +
                "HgFifcvkXAnWKoosUtj0Bban/YBRyvmQ5C2akxUPEkr4Yck1QXwzJeNRd7wMXHjH\n" +
                "JFK6lJcuABiB8wpJDXJkFzKs29pvHIK2B2vdOjU2rQzKOUwaKHofDi5C4+JitT2b\n" +
                "2pSeYP3PAxXYw6XDOmKTOiC7fPnfLjtcPjNYNFCezVKZT6LKvZW9obnW8Q9LNJ4W\n" +
                "okMPgHObkabv3OqUaTA9QNVfI/X9nvggzlPnaKDUrDWTf7n3vlrdexugkLtV/tJA\n" +
                "uguPlI5hY7Ue5OW7ckWP46hfmq1+UaIdeUY7dEO+rPZDz6KcArpaRwBiLPBhneIr\n" +
                "/X3KuMzS272YbPbavgCZGN9xJR5kZsEQE5HhPCbr6Nf0qDnh+X8mg0tAB/U6F+ZE\n" +
                "o90sJL1ssIaYvST+VWVaGRr4V5nMDcgHzWSF9Q/wm22zxe4alDaBdvOlUseW0iaM\n" +
                "n2DMz6gqk326W6SFynYtvuiXo7wG4Cmn3SuIU8xfv9rJqunpZGYchMd7nZektmEJ\n" +
                "91Js0rQ=\n" +
                "=A/Ii\n" +
                "-----END PGP SIGNATURE-----";
        String content = extractedTextContentFromVerifyAscFile(ascFileContent, cacheFilePath);

        String ascFileContent2 = "-----BEGIN PGP SIGNED MESSAGE-----\n" +
                "Hash: SHA256\n" +
                "\n" +
                "df3249b2ffb84bc66530c6f93c6fbe8ed2bcdbc0576ed1657800c4a697316267  OneKey-Wallet-5.10.0-android.apk\n" +
                "-----BEGIN PGP SIGNATURE-----\n" +
                "\n" +
                "iQJCBAEBCAAsFiEE62iuVE8f3YzSZGJPs2mmepC/OHsFAmhmdH4OHGRldkBvbmVr\n" +
                "ZXkuc28ACgkQs2mmepC/OHsTDA/+LoSfk0a3tMpJFunBltzWClLsyZIbkrDJwlT4\n" +
                "gnGuHpOzm3q+GOmsq1T0R7dz91/K2pe5P5efE6cBT+YtlscHqVwRR3ziDO+O0Fyn\n" +
                "pnkbfpYr2LeYKa89L5/U4cMKOcSi2HJ0dOTicrqRyJZFSLDHNwoteFCK3PN2NJGM\n" +
                "okK9lVqE+6Ze1NqSDRfvJlyt0eFl+Gd6N2oOXoEh4nfqdl07BIcadAUrQ9ESzaXi\n" +
                "sCt8TJKYRySqdc28U4YkchQjZAJj+pIYb1RUjli/Xgd6jLKHSAX0ZObxjQvpdIVn\n" +
                "O/yCOBsDtZVAW6gVrToHM+z4xuE2Q/4PXyZOGtIKasldQtf5mFnB5JjxJtO5fcaq\n" +
                "c1Cel/vYXGL1Ye2Cwg8HIBAQkiL3z2q7/w2xfNEhY/nSsOshuJ1Aa/1ZWH7AVn1w\n" +
                "RRKzVS1Qka4cT01SNKmN/B6yVV/dCS8XbUTIRx+2en+JNwHcBFH3NzpNs96wd053\n" +
                "xU1re9XrNe5wM9jPpP/Y6T9Z0apn3Ksf8HVMJdfdAIcTH7lwQlJGXjza87teqIaD\n" +
                "mBzpzs7bkR8AvlhXMTyvDosE2nVD9e6nuZq74YCmqx+npelOqGxsA3j8doK5ARiA\n" +
                "3GZte6Bg5yXBRxK1X8nwKSN5CZLlp5QWyY9NZXBAZKyV3u4MzWITHY4WqlF7eph9\n" +
                "LgEB7DE=\n" +
                "=tnDs\n" +
                "-----END PGP SIGNATURE-----";
        
        String extractedSha256 = extractedSha256FromVerifyAscFile(ascFileContent2, cacheFilePath);

        if (content == null || content.isEmpty()) {
            return false;
        }
        
        try {
            // Parse the JSON content to extract sha256
            org.json.JSONObject jsonObject = new org.json.JSONObject(content);
            String expectedSha256 = jsonObject.getString("sha256");
            return expectedSha256.equals("2ada9c871104fc40649fa3de67a7d8e33faadc18e9abd587e8bb85be0a003eba") && extractedSha256.equals("df3249b2ffb84bc66530c6f93c6fbe8ed2bcdbc0576ed1657800c4a697316267");
        } catch (Exception e) {
            return false;
        }

       
    }
}
