
## 🌍 Configurazione dell'ambiente

1. installare [node.js versione LTS (>= 16)](https://nodejs.org/en/)
2. installare lo [strumento di gestione dei pacchetti yarn](https://yarnpkg.com/)
3. installare [git lfs](https://git-lfs.github.com/) (necessario per tirare e aggiornare alcuni binari)

Dopo aver prelevato l'ultimo codice tramite lo strumento a riga di comando git, installare le dipendenze del progetto nella directory principale con il comando ``yarn``

```
# Installa tutte le dipendenze JS e i sottomoduli

filato

# Installa globalmente lo strumento a riga di comando expo

npm install -g expo-cli
```

## 🛠 Sviluppo

Sviluppare codice commerciale diverso eseguendo i seguenti comandi nella directory principale

- `yarn web`: sviluppa la modalità web, che avvierà localmente un server statico sulla porta 3000
- `yarn ios`: debug dello sviluppo su dispositivi iphone tramite connessione USB
- `yarn android`: debug di Android
- `yarn desktop`: sviluppo in modalità desktop

### Configurazione del progetto Android

#### Primo metodo: per gli sviluppatori della comunità

Configura le chiavi rilevanti in `packages/app/android/lib-keys-secret/src/main/cpp/keys.c`, o usa le opzioni predefinite. Alcune API possono avere delle restrizioni.

#### Secondo modo: per gli sviluppatori ufficiali

1. Vai al repository di crittografia e prendi il file `debug.keystore` e mettilo nella directory `packages/app/android/keystores`, se non lo hai, crealo tu stesso.
2. Vai al repository di crittografia e prendi il file `keys.secret` e mettilo nella directory `packages/app/android`.

## 🗂 Struttura di directory di repository multipli

I repository sono organizzati utilizzando il modello monorepo per mantenere il codice su diverse estremità centralizzato e non influenzato, permettendo allo stesso tempo il maggior riutilizzo possibile del codice durante il processo di impacchettamento e compilazione

- `packages/components` per i componenti UI
- `packages/kit` contiene contenuti UI riutilizzabili a livello di pagina
- `packages/app` codice APP
- `packages/desktop` Codice elettronico del desktop
- `pacchetti/web` codice lato web
- `pacchetti/estensione` Codice lato plugin

## 🧲 Installare le dipendenze

Ogni sottodirectory sotto la directory `packages/` è un progetto separato, il cui nome è il valore del campo `name` nella directory **package.json** in monorepo.

Quando hai bisogno di installare una dipendenza per una sottodirectory, usa semplicemente `yarn workspace @onekeyhq/web add axios`. Con un prefisso come `yarn workspace @onekeyhq/web`, il modulo axios può eventualmente essere installato nella directory principale del sottoprogetto web.

Alcune delle dipendenze hanno parti native, quindi dovrai andare nella directory `packages/app/ios` ed eseguire `pod install` dopo aver installato le dipendenze JS.

## 😷 Domande frequenti

1. L'applicazione non si avvia

Cancellare la cache dello strumento di packaging con il comando `--reset-cache` in `yarn native` nella directory principale. Usa anche il comando `-yarn clean` nella directory principale per cancellare tutte le dipendenze e i file generati e poi esegui nuovamente `-yarn` per installare le dipendenze.
