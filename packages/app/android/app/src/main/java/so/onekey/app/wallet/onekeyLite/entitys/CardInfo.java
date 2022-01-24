package so.onekey.app.wallet.onekeyLite.entitys;


import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;


public class CardInfo {

    /**
     * bleVersion :
     * firmwareVersion :
     * label :
     * pinMaxRetry : 10
     * pinRetry : 10
     * sn : BXNFC20052500001
     */

    @SerializedName("bleVersion")
    private String bleVersion;
    @SerializedName("firmwareVersion")
    private String firmwareVersion;
    @SerializedName("label")
    private String label;
    @SerializedName("pinMaxRetry")
    private int pinMaxRetry;
    @SerializedName("pinRetry")
    private int pinRetry;
    @SerializedName("sn")
    private String sn;

    public static CardInfo objectFromData(String str) {

        return new Gson().fromJson(str, CardInfo.class);
    }

    public String getBleVersion() {
        return bleVersion;
    }

    public void setBleVersion(String bleVersion) {
        this.bleVersion = bleVersion;
    }

    public String getFirmwareVersion() {
        return firmwareVersion;
    }

    public void setFirmwareVersion(String firmwareVersion) {
        this.firmwareVersion = firmwareVersion;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public int getPinMaxRetry() {
        return pinMaxRetry;
    }

    public void setPinMaxRetry(int pinMaxRetry) {
        this.pinMaxRetry = pinMaxRetry;
    }

    public int getPinRetry() {
        return pinRetry;
    }

    public void setPinRetry(int pinRetry) {
        this.pinRetry = pinRetry;
    }

    public String getSn() {
        return sn;
    }

    public void setSn(String sn) {
        this.sn = sn;
    }
}
