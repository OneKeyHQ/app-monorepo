# Chrome

```bash
# watch and build code
yarn ext

# >>>> wait building done...

# Install extension to Chrome manually: 
# - Open Chrome Browser, navigate to chrome://extensions/
# - Toggle on 「Developer mode」
# - Click button 「Load unpacked」
# - Choose folder ./app-monorepo/packages/ext/build/chrome/
```

# Firefox

```bash
# watch and build code
yarn ext --firefox

# >>>> wait building done...

# Start new Firefox instance with extension installed
# you need install web-ext first: 
#   npm install --global web-ext
yarn firefox
```
