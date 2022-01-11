package so.onekey.app.wallet.onekeyLite.entitys;

import androidx.annotation.NonNull;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

/**
 * @author liyan
 * @date 2020/7/18
 */
//
public class SecureChanelParam {

    @SerializedName("scpID")
    private String scpID;

    @SerializedName("keyUsage")
    private String keyUsage;

    @SerializedName("keyType")
    private String keyType;

    @SerializedName("keyLength")
    private int keyLength;

    @SerializedName("hostID")
    private String hostID;

    @SerializedName("crt")
    private String crt;

    @SerializedName("sk")
    private String sk;

    @SerializedName("cardGroupID")
    private String cardGroupID;

    public static SecureChanelParam objectFromData(String str) {

        return new Gson().fromJson(str, SecureChanelParam.class);
    }

    public String getScpID() {
        return scpID;
    }

    public void setScpID(String scpID) {
        this.scpID = scpID;
    }

    public String getKeyUsage() {
        return keyUsage;
    }

    public void setKeyUsage(String keyUsage) {
        this.keyUsage = keyUsage;
    }

    public String getKeyType() {
        return keyType;
    }

    public void setKeyType(String keyType) {
        this.keyType = keyType;
    }

    public int getKeyLength() {
        return keyLength;
    }

    public void setKeyLength(int keyLength) {
        this.keyLength = keyLength;
    }

    public String getHostID() {
        return hostID;
    }

    public void setHostID(String hostID) {
        this.hostID = hostID;
    }

    public String getCrt() {
        return crt;
    }

    public void setCrt(String crt) {
        this.crt = crt;
    }

    public String getSk() {
        return sk;
    }

    public void setSk(String sk) {
        this.sk = sk;
    }

    public String getCardGroupID() {
        return cardGroupID;
    }

    public void setCardGroupID(String cardGroupID) {
        this.cardGroupID = cardGroupID;
    }

    @NonNull
    @Override
    public String toString() {
        return new Gson().toJson(this);
    }
}
