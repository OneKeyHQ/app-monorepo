
## 🌍 Konfiguration der Umgebung

1. installieren Sie [node.js LTS Version (>= 16)](https://nodejs.org/en/)
2. Installieren Sie das [yarn package management tool](https://yarnpkg.com/)
3. installieren Sie [git lfs](https://git-lfs.github.com/) (erforderlich für das Ziehen und Aktualisieren einiger Binärdateien)

Nachdem Sie den neuesten Code über das Git-Kommandozeilen-Tool geholt haben, installieren Sie die Projektabhängigkeiten im Hauptverzeichnis mit dem Befehl ``yarn``

```
# Installation aller JS-Abhängigkeiten und Submodul-Abhängigkeiten

Garn

# Das Kommandozeilenprogramm expo global installieren

npm install -g expo-cli
```

## 🛠 Entwicklung

Entwickeln Sie verschiedene Geschäftscodes, indem Sie die folgenden Befehle im Stammverzeichnis ausführen

- yarn web": Web-Modus entwickeln, der einen statischen Server auf Port 3000 lokal startet
- yarn ios": Debugging-Entwicklung auf iphone-Geräten über USB-Verbindung
- yarn android": Fehlersuche für Android
- yarn desktop": Entwicklung im Desktop-Modus

### Android-Projektkonfiguration

#### Erste Methode: für Gemeindeentwickler

Konfigurieren Sie die entsprechenden Schlüssel in `packages/app/android/lib-keys-secret/src/main/cpp/keys.c`, oder verwenden Sie die Standardoptionen. Einige APIs können Einschränkungen haben.

#### Zweiter Weg: für offizielle Entwickler

1. gehen Sie zum Verschlüsselungs-Repository und holen Sie die Datei "debug.keystore" und legen Sie sie in das Verzeichnis "packages/app/android/keystores", wenn Sie sie nicht haben, erstellen Sie sie selbst.
2. gehen Sie zum Verschlüsselungs-Repository und holen Sie die Datei `keys.secret` und legen Sie sie in das Verzeichnis `packages/app/android`.

## 🗂 Mehrere Repository-Verzeichnisstrukturen

Die Repositories sind nach dem Monorepo-Modell organisiert, um den Code auf verschiedenen Seiten zentralisiert und unberührt zu halten und gleichzeitig die Wiederverwendung von Code während des Paketierungs- und Kompilierungsprozesses so weit wie möglich zu ermöglichen

- Pakete/Komponenten" für UI-Komponenten
- packages/kit" enthält wiederverwendbare UI-Inhalte auf Seitenebene
- packages/app` APP-Code
- Pakete/Desktop" Desktop-Elektronencode
- Pakete/Web" Webseitiger Code
- Packages/Erweiterung" Plugin-seitiger Code

## 🧲 Abhängigkeiten installieren

Jedes Unterverzeichnis unter dem Verzeichnis `packages/` ist ein separates Projekt, dessen Name dem Wert des Feldes `name` im Verzeichnis **package.json** in monorepo entspricht.

Wenn Sie eine Abhängigkeit für ein Unterverzeichnis installieren müssen, verwenden Sie einfach `yarn workspace @onekeyhq/web add axios`. Mit einem Präfix wie `yarn workspace @onekeyhq/web` kann das axios-Modul schließlich im Stammverzeichnis des Web-Unterprojekts installiert werden.

Einige der Abhängigkeiten haben native Teile, daher müssen Sie in das Verzeichnis `packages/app/ios` gehen und `pod install` ausführen, nachdem Sie die JS-Abhängigkeiten installiert haben.

## 😷 Häufig gestellte Fragen

1. die App startet nicht

Löschen Sie den Cache des Paketierungswerkzeugs mit dem Befehl `--reset-cache` in `yarn native` im Stammverzeichnis. Verwenden Sie auch den Befehl `-yarn clean` im Hauptverzeichnis, um alle Abhängigkeiten und erzeugten Dateien zu löschen und führen Sie dann `-yarn` erneut aus, um die Abhängigkeiten zu installieren.
