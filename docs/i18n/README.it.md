
## 🌍 Configurazione dell'ambiente

1. installare [node.js versione LTS (>= 22)](https://nodejs.org/en/)
2. Installare [Yarn](https://yarnpkg.com/) 4.x tramite Corepack.
3. installare [git lfs](https://git-lfs.github.com/) (necessario per tirare e aggiornare alcuni binari)
4. Per avviare il progetto iOS, assicurati che la versione locale di XCode sia maggiore o uguale a 13.3
5. Per avviare il progetto Android, assicurati che la versione JDK locale sia maggiore o uguale a 11

Dopo aver prelevato l'ultimo codice tramite lo strumento a riga di comando git, installare le dipendenze del progetto nella directory principale con il comando ``yarn``

Installa tutte le dipendenze JS e i sottomoduli

```
yarn
```

## 🛠 Sviluppo

Sviluppare codice commerciale diverso eseguendo i seguenti comandi nella directory principale

- `yarn app:web`: sviluppa la modalità web, che avvierà localmente un server statico sulla porta 3000
- `yarn app:ios`: esegue l'app iOS nel simulatore predefinito
- `yarn app:ios:device`: esegue l'app iOS su un dispositivo collegato via USB
- `yarn app:android`: debug di Android
- `yarn app:desktop`: sviluppo in modalità desktop
- `yarn app:ext`: sviluppa plugin per browser

### Configurazione del progetto Android

#### Primo metodo: per gli sviluppatori della comunità

Configura le chiavi rilevanti in `apps/android/lib-keys-secret/src/main/cpp/keys.c`, o usa le opzioni predefinite. Alcune API possono avere delle restrizioni.

#### Secondo modo: per gli sviluppatori ufficiali

1. Vai al repository di crittografia e prendi il file `debug.keystore` e mettilo nella directory `apps/android/keystores`, se non lo hai, crealo tu stesso.
2. Vai al repository di crittografia e prendi il file `keys.secret` e mettilo nella directory `apps/android`.

## 🗂 Struttura di directory di repository multipli

I repository sono organizzati utilizzando il modello monorepo per mantenere il codice su diverse estremità centralizzato e non influenzato, permettendo allo stesso tempo il maggior riutilizzo possibile del codice durante il processo di impacchettamento e compilazione

- `packages/components` per i componenti UI
- `packages/kit` contiene contenuti UI riutilizzabili a livello di pagina
- `apps` codice APP
- `apps/desktop` Codice elettronico del desktop
- `pacchetti/web` codice lato web
- `pacchetti/ext` Codice lato plugin

## 🧲 Installare le dipendenze

Ogni sottodirectory sotto la directory `packages/` è un progetto separato, il cui nome è il valore del campo `name` nella directory **package.json** in monorepo.

Quando hai bisogno di installare una dipendenza per una sottodirectory, usa semplicemente `yarn workspace @onekeyhq/web add axios`. Con un prefisso come `yarn workspace @onekeyhq/web`, il modulo axios può eventualmente essere installato nella directory principale del sottoprogetto web.

Alcune delle dipendenze hanno parti native, quindi dovrai andare nella directory `apps/ios` ed eseguire `pod install` dopo aver installato le dipendenze JS.

## 😷 Domande frequenti

1. L'app non può essere avviata e vari problemi di avvio dell'ambiente

Per qualsiasi problema relativo all'ambiente, ai moduli e alle dipendenze nella fase di avvio, si consiglia di utilizzare prima il comando `yarn clean` nella directory principale. Il comando cancellerà tutte le sotto-dipendenze, così come la cache del modulo di yarn, la cache di strumenti come metro/babel, e quindi riavvierà il progetto per provare.

2. Durante l'installazione delle dipendenze o quando si aggiungono nuove dipendenze, il filato visualizzerà **errore Si è verificato un errore imprevisto: "prevista l'esistenza del pacchetto dell'area di lavoro per**

Verifica prima che Corepack sia abilitato e che l'ambiente stia usando la versione Yarn 4 dichiarata dal repository.
