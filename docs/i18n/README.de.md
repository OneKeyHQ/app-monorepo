
## 🌍 Konfiguration der Umgebung

1. installieren Sie [node.js LTS Version (>= 22)](https://nodejs.org/en/)
2. Installieren Sie [Yarn](https://yarnpkg.com/) 4.x über Corepack.
3. installieren Sie [git lfs](https://git-lfs.github.com/) (erforderlich für das Ziehen und Aktualisieren einiger Binärdateien)
4. Stellen Sie zum Starten des iOS-Projekts sicher, dass die lokale XCode-Version größer oder gleich 13.3 ist
5. Um das Android-Projekt zu starten, stellen Sie sicher, dass die lokale JDK-Version größer oder gleich 11 ist

Nachdem Sie den neuesten Code über das Git-Kommandozeilen-Tool geholt haben, installieren Sie die Projektabhängigkeiten im Hauptverzeichnis mit dem Befehl ``yarn``

Installation aller JS-Abhängigkeiten und Submodul-Abhängigkeiten

```
yarn
```

## 🛠 Entwicklung

Entwickeln Sie verschiedene Geschäftscodes, indem Sie die folgenden Befehle im Stammverzeichnis ausführen

- `yarn app:web`: Web-Modus entwickeln, der einen statischen Server auf Port 3000 lokal startet
- `yarn app:ios`: führt die iOS-App im Standard-Simulator aus
- `yarn app:ios:device`: führt die iOS-App auf einem per USB verbundenen Gerät aus
- `yarn app:android`: Fehlersuche für Android
- `yarn app:desktop`: Entwicklung im Desktop-Modus
- `yarn app:ext`: Entwicklung von Browser-Plugins

### Android-Projektkonfiguration

#### Erste Methode: für Gemeindeentwickler

Konfigurieren Sie die entsprechenden Schlüssel in `apps/android/lib-keys-secret/src/main/cpp/keys.c`, oder verwenden Sie die Standardoptionen. Einige APIs können Einschränkungen haben.

#### Zweiter Weg: für offizielle Entwickler

1. gehen Sie zum Verschlüsselungs-Repository und holen Sie die Datei "debug.keystore" und legen Sie sie in das Verzeichnis "apps/android/keystores", wenn Sie sie nicht haben, erstellen Sie sie selbst.
2. gehen Sie zum Verschlüsselungs-Repository und holen Sie die Datei `keys.secret` und legen Sie sie in das Verzeichnis `apps/android`.

## 🗂 Mehrere Repository-Verzeichnisstrukturen

Die Repositories sind nach dem Monorepo-Modell organisiert, um den Code auf verschiedenen Seiten zentralisiert und unberührt zu halten und gleichzeitig die Wiederverwendung von Code während des Paketierungs- und Kompilierungsprozesses so weit wie möglich zu ermöglichen

- Pakete/Komponenten" für UI-Komponenten
- packages/kit" enthält wiederverwendbare UI-Inhalte auf Seitenebene
- apps` APP-Code
- Pakete/desktop" Desktop-Elektronencode
- Pakete/web" Webseitiger Code
- Packages/ext" Plugin-seitiger Code

## 🧲 Abhängigkeiten installieren

Jedes Unterverzeichnis unter dem Verzeichnis `packages/` ist ein separates Projekt, dessen Name dem Wert des Feldes `name` im Verzeichnis **package.json** in monorepo entspricht.

Wenn Sie eine Abhängigkeit für ein Unterverzeichnis installieren müssen, verwenden Sie einfach `yarn workspace @onekeyhq/web add axios`. Mit einem Präfix wie `yarn workspace @onekeyhq/web` kann das axios-Modul schließlich im Stammverzeichnis des Web-Unterprojekts installiert werden.

Einige der Abhängigkeiten haben native Teile, daher müssen Sie in das Verzeichnis `apps/ios` gehen und `pod install` ausführen, nachdem Sie die JS-Abhängigkeiten installiert haben.

## 😷 Häufig gestellte Fragen

1. Die App kann nicht gestartet werden und verschiedene Umgebungsstartprobleme

Bei allen Umgebungs-, Modul- und Abhängigkeitsproblemen in der Startphase wird empfohlen, zuerst den Befehl "yarn clean" im Stammverzeichnis zu verwenden. Der Befehl löscht alle untergeordneten Abhängigkeiten sowie den Modul-Cache von Garn, den Cache von Tools wie Metro / Babel und startet dann das Projekt neu, um es zu versuchen.

2. Während der Installation von Abhängigkeiten oder beim Hinzufügen neuer Abhängigkeiten zeigt Yarn **Fehler an. Ein unerwarteter Fehler ist aufgetreten: "expected workspace package to exist for**

Prüfen Sie zuerst, ob Corepack aktiviert ist und ob die Umgebung die vom Repository deklarierte Yarn-4-Version verwendet.
