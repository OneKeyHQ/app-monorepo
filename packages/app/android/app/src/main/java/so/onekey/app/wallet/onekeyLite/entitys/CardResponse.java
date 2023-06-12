package so.onekey.app.wallet.onekeyLite.entitys;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

/**
 * @author  liyan
 * @date 2020/7/15
 */
//
public class CardResponse {

    @SerializedName(value = "response", alternate = "value")
    private String response;
    @SerializedName(value = "wRet", alternate = "tag")
    private int wRet;

    public static CardResponse objectFromData(String str) {
        return new Gson().fromJson(str, CardResponse.class);
    }

    public String getResponse() {
        return response;
    }

    public void setResponse(String response) {
        this.response = response;
    }

    public int getWRet() {
        return wRet;
    }

    public void setWRet(int wRet) {
        this.wRet = wRet;
    }
}
