/*
 * Copyright 2023 The Android Open Source Project
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       https://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import com.android.build.api.dsl.ApplicationExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import so.onekey.apps.EnvManager

class AndroidApplicationVersionConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            extensions.configure<ApplicationExtension> {
                val appConfig = EnvManager.readRootVersionEnv()
                val appVersion = EnvManager.defEnvStr(appConfig, "VERSION")
                val appVersionCode = EnvManager.defEnvStr(appConfig, "BUILD_NUMBER", "1").toInt()

                this.defaultConfig.versionCode = appVersionCode
                this.defaultConfig.versionName = appVersion

                println("App Version: $appVersion")
                println("App VersionCode: $appVersionCode")
            }
        }
    }
}