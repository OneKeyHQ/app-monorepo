
## 🌍 Configuration de l'environnement

1. installer [node.js LTS version (>= 16)](https://nodejs.org/en/)
2. installez l'[outil de gestion des paquets yarn](https://yarnpkg.com/)
3. installer [git lfs](https://git-lfs.github.com/) (nécessaire pour tirer et mettre à jour certains binaires)

Après avoir récupéré le dernier code via l'outil en ligne de commande git, installez les dépendances du projet dans le répertoire racine avec la commande ``yarn``.

```
# Installer toutes les dépendances JS et les dépendances du sous-module

fils

# Installer globalement l'outil de ligne de commande expo

npm install -g expo-cli
```

## 🛠 Développement

Développez un code commercial différent en exécutant les commandes suivantes dans le répertoire racine

- `yarn web` : développer le mode web, qui démarrera localement un serveur statique sur le port 3000
- `yarn ios` : déboguer le développement sur les appareils iphone via une connexion USB
- `yarn android` : déboguer Android
- `yarn desktop` : développement en mode desktop

### Configuration du projet Android

#### Première méthode : pour les développeurs communautaires

Configurez les clés pertinentes dans `packages/app/android/lib-keys-secret/src/main/cpp/keys.c`, ou utilisez les options par défaut. Certaines API peuvent présenter des limitations.

#### Deuxième voie : pour les développeurs officiels

1. allez dans le dépôt de cryptage et récupérez le fichier `debug.keystore` et mettez-le dans le répertoire `packages/app/android/keystores`, si vous ne l'avez pas, créez-le vous-même.
2. allez dans le dépôt de cryptage et récupérez le fichier `keys.secret` et mettez-le dans le répertoire `packages/app/android`.

## 🗂 Structure de répertoires de dépôts multiples

Les dépôts sont organisés selon le modèle monorepo afin de centraliser et de ne pas affecter le code des différentes extrémités, tout en permettant une réutilisation maximale du code au cours du processus de conditionnement et de compilation.

- `packages/components` pour les composants de l'interface utilisateur.
- `packages/kit` contient le contenu réutilisable de l'interface utilisateur au niveau de la page.
- `packages/app` Code APP
- `packages/desktop` Code électronique du bureau
- `packages/web` code côté web
- `packages/extension` Code côté plugin

## 🧲 Installer les dépendances

Chaque sous-répertoire sous le répertoire `packages/` est un projet séparé, dont le nom est la valeur du champ `name` dans le répertoire **package.json** de monorepo.

Lorsque vous avez besoin d'installer une dépendance pour un sous-répertoire, utilisez simplement `yarn workspace @onekeyhq/web add axios`. Avec un préfixe comme `yarn workspace @onekeyhq/web`, le module axios peut éventuellement être installé dans le répertoire racine du sous-projet web.

Certaines des dépendances ont des parties natives, vous devrez donc aller dans le répertoire `packages/app/ios` et lancer `pod install` après avoir installé les dépendances JS.

## 😷 Questions fréquemment posées

1. l'application ne démarre pas

Videz le cache de l'outil de packaging avec la commande `--reset-cache` dans `yarn native` dans le répertoire racine. Utilisez également la commande `-yarn clean` dans le répertoire racine pour effacer toutes les dépendances et les fichiers générés, puis relancez `-yarn` pour installer les dépendances.
