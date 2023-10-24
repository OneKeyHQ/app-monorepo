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
        val maxDepth = 8
        var currentDepth = 0
        var currentPath = "./"

        val props = Properties()
        while (currentDepth < maxDepth) {
            val potentialFile = File(currentPath + fileName)
            if (potentialFile.exists()) {
                try {
                    potentialFile.inputStream().use { stream ->
                        props.load(stream)
                    }
                    println("Success Load $fileName at ${potentialFile.absolutePath}")
                } catch (ignore: Exception) {
                    // ignore
                }
                return props
            }

            currentPath += "../" // Go one directory up
            currentDepth++
        }

        return props // Return empty properties if file wasn't found
    }
}


