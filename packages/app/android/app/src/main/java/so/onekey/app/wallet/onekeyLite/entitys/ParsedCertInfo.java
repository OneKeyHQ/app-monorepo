package so.onekey.app.wallet.onekeyLite.entitys;

/**
 * @author liyan
 * @date 2/23/21
 */
//

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

/** sn : subjectID： */
public class ParsedCertInfo {
    @SerializedName("sn")
    public String sn;

    @SerializedName("subjectID")
    public String subjectID;

    public static ParsedCertInfo objectFromData(String str) {
        return new Gson().fromJson(str, ParsedCertInfo.class);
    }

    public String getSn() {
        return sn;
    }

    public void setSn(String sn) {
        this.sn = sn;
    }

    public String getSubjectID() {
        return subjectID;
    }

    public void setSubjectID(String subjectID) {
        this.subjectID = subjectID;
    }
}
