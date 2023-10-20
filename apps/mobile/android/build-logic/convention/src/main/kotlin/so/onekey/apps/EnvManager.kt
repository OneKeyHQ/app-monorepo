package so.onekey.apps

import java.util.Properties
import java.io.File

object EnvManager {
    fun defEnvStr(config: Properties, key: String, defValue: String = "1"): String {
        var value = config.getProperty(key)
        if (value == null || value.isEmpty()) {
            val envParam = System.getenv()
            value = envParam[key]
        }
        return value ?: defValue
    }

    fun readRootVersionEnv(): Properties {
        return readRootEnvFile(".env.version")
    }

    fun readRootEnv(): Properties {
        return readRootEnvFile(".env")
    }

    fun readRootEnvFile(fileName: String): Properties {
        // base file path: apps/mobile/android/
        val rootEnvPath = "./../../../"

        val props = Properties()
        try {
            File(rootEnvPath + File.separator + fileName).inputStream().use { stream ->
                props.load(stream)
            }
        } catch (ignore: Exception) {
            // ignore
        }
        return props
    }
}


