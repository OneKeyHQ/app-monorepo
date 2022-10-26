# react-native-minimizer

## Getting started

`$ npm install react-native-minimizer --save`

### Mostly automatic installation

Add this to your `android/build.gradle` file, under `allprojects.repositories`:

```
allprojects {
  repositories {
    // ...
    maven {
      url("${project(':react-native-minimizer').projectDir}/libs")
    }
  }
}
```

## Usage
```javascript
import Minimizer from 'react-native-minimizer';

// exits the aplication
Minimizer.exit();
// goes back to previously openned app if there was such
Minimizer.goBack();
// just minimizes the app
Minimizer.minimize();
```
