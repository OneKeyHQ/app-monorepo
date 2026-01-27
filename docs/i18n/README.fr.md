
## 🌍 Configuration de l'environnement

1. installer [node.js LTS version (>= 16)](https://nodejs.org/en/)
2. Installez [Bun](https://bun.sh/)
3. installer [git lfs](https://git-lfs.github.com/) (nécessaire pour tirer et mettre à jour certains binaires)
4. Pour démarrer le projet iOS, assurez-vous que la version locale de XCode est supérieure ou égale à 13.3
5. Pour démarrer le projet Android, assurez-vous que la version locale du JDK est supérieure ou égale à 11

Après avoir récupéré le dernier code via l'outil en ligne de commande git, installez les dépendances du projet dans le répertoire racine avec la commande `bun install`

Installer toutes les dépendances JS et les dépendances du sous-module

```
bun install
```

## 🛠 Développement

Développez un code commercial différent en exécutant les commandes suivantes dans le répertoire racine

- `bun run app:web`: développer le mode web, qui démarrera localement un serveur statique sur le port 3000
- `bun run app:ios`: déboguer le développement sur les appareils iphone via une connexion USB
- `bun run app:android`: déboguer Android
- `bun run app:desktop`: développement en mode desktop
- `bun run app:ext`: développer des plugins de navigateur

### Configuration du projet Android

#### Première méthode : pour les développeurs communautaires

Configurez les clés pertinentes dans `apps/android/lib-keys-secret/src/main/cpp/keys.c`, ou utilisez les options par défaut. Certaines API peuvent présenter des limitations.

#### Deuxième voie : pour les développeurs officiels

1. allez dans le dépôt de cryptage et récupérez le fichier `debug.keystore` et mettez-le dans le répertoire `apps/android/keystores`, si vous ne l'avez pas, créez-le vous-même.
2. allez dans le dépôt de cryptage et récupérez le fichier `keys.secret` et mettez-le dans le répertoire `apps/android`.

## 🗂 Structure de répertoires de dépôts multiples

Les dépôts sont organisés selon le modèle monorepo afin de centraliser et de ne pas affecter le code des différentes extrémités, tout en permettant une réutilisation maximale du code au cours du processus de conditionnement et de compilation.

- `packages/components` pour les composants de l'interface utilisateur.
- `packages/kit` contient le contenu réutilisable de l'interface utilisateur au niveau de la page.
- `apps` Code APP
- `apps/desktop` Code électronique du bureau
- `apps/web` code côté web
- `apps/ext` Code côté plugin

## 🧲 Installer les dépendances

Chaque sous-répertoire sous le répertoire `packages/` est un projet séparé, dont le nom est la valeur du champ `name` dans le répertoire **package.json** de monorepo.

Lorsque vous avez besoin d'installer une dépendance pour un sous-répertoire, utilisez simplement `bun add axios --cwd apps/web`. Avec un paramètre comme `--cwd apps/web`, le module axios peut éventuellement être installé dans le répertoire racine du sous-projet web.

Certaines des dépendances ont des parties natives, vous devrez donc aller dans le répertoire `apps/ios` et lancer `pod install` après avoir installé les dépendances JS.

## 😷 Questions fréquemment posées

1. L'application ne peut pas être démarrée et divers problèmes de démarrage de l'environnement

Pour tout problème d'environnement, de module et de dépendance dans la phase de démarrage, il est recommandé d'utiliser d'abord la commande `bun run clean` dans le répertoire racine. La commande effacera toutes les sous-dépendances, ainsi que le cache du module, le cache des outils tels que metro/babel, puis redémarrera le projet pour essayer.
