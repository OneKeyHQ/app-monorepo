import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

/*
 * Copyright 2022 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

plugins {
    `kotlin-dsl`
}

group = "so.onekey.apps.buildlogic"

// Configure the build-logic plugins to target JDK 11
// This matches the JDK used to build the project, and is not related to what is running on device.
java {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
}
tasks.withType<KotlinCompile>().configureEach {
    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }
}

dependencies {
    compileOnly("com.android.tools.build:gradle:7.4.2")
    compileOnly("org.jetbrains.kotlin:kotlin-gradle-plugin:1.8.10")
}

gradlePlugin {
    plugins {
        register("androidApplication") {
            id = "onekey.android.application"
            implementationClass = "AndroidApplicationConventionPlugin"
        }
        register("androidFlavors") {
            id = "onekey.android.application.flavors"
            implementationClass = "AndroidApplicationFlavorsConventionPlugin"
        }
        register("androidVersion") {
            id = "onekey.android.application.version"
            implementationClass = "AndroidApplicationVersionConventionPlugin"
        }
    }
}
