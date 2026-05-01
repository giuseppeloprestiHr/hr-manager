# NAS Direct Access App — Documento di Progetto

**Hardware:** QNAP TS-231P2 (processore ARM Cortex-A15, 1 GB RAM, 2 bay)  
**Data:** 2026-05-01  
**Versione documento:** 1.0

---

## 1. Obiettivo

Costruire una web application personalizzata che sostituisca il software proprietario QNAP
per la gestione del NAS, offrendo:

- Un'interfaccia file manager classica (simile a Windows Explorer / Finder)
- Accesso da qualsiasi dispositivo (telefono, tablet, PC) tramite browser
- Accesso sicuro anche dall'esterno della rete di casa
- Notifiche automatiche in caso di problemi ai dischi o allo storage
- Gestione e riavvio automatico del software

---

## 2. Perché non il software QNAP

Il software proprietario QNAP (QFile, File Station) presenta limitazioni nell'interfaccia
di gestione cartelle e file che rendono l'esperienza meno efficiente rispetto a un
file manager tradizionale. L'obiettivo è avere pieno controllo sull'interfaccia e sul
comportamento dell'applicazione, senza dipendere dagli aggiornamenti e dalle scelte del produttore.

---

## 3. Architettura generale

```
[Telefono / PC]
      |
      | HTTPS
      v
[Cloudflare Tunnel]   <-- nessuna porta aperta sul router
      |
      v
[QNAP TS-231P2]
  └── Container Station (Docker)
        ├── nas-app          (backend Node.js + frontend React)
        └── cloudflared      (client Cloudflare Tunnel)
              |
              v
        [API QNAP interna]  (File Station API, System API)
```

**Principio chiave:** il backend gira dentro il QNAP stesso tramite Docker.
Non serve nessun server esterno. Il traffico da internet arriva tramite
Cloudflare Tunnel, che non richiede di aprire porte sul router.

---

## 4. Soluzioni scelte

### 4.1 Accesso remoto — Cloudflare Tunnel

**Perché Cloudflare Tunnel:**
- Gratuito (account Cloudflare Free)
- Non richiede aprire porte sul router di casa
- Nasconde l'IP pubblico di casa
- HTTPS automatico con certificato valido
- Permette condivisione link con chiunque (non solo dispositivi nella VPN)
- Protezione DDoS di base inclusa in Cloudflare

**Alternativa scartata — Port forwarding:** espone direttamente il router a internet,
richiede IP statico o DDNS, non include HTTPS automatico.

**Alternativa scartata — Tailscale:** ottima per accesso personale ma non permette
condivisione link con persone esterne senza che installino Tailscale.

### 4.2 Runtime applicazione — Docker (Container Station)

**Perché Docker sul QNAP:**
- Container Station è disponibile gratuitamente nell'App Center QNAP
- Isola l'applicazione dal sistema operativo del NAS
- Riavvio automatico in caso di crash (`restart: always`)
- Aggiornamenti facili senza toccare il sistema QNAP
- ARM-compatibile (immagini Node.js Alpine per ARMv7)

### 4.3 Backend — Node.js + Express

**Perché Node.js:**
- Leggero su RAM (importante: il TS-231P2 ha solo 1 GB)
- Gestisce bene lo streaming di file
- Ampia disponibilità di librerie per sicurezza, notifiche, SMTP
- Immagini Docker ufficiali per ARM

Il backend fa da intermediario tra il browser e le API interne QNAP.
Le credenziali QNAP non escono mai verso il browser.

### 4.4 Frontend — React + Vite, installabile come PWA

**Perché PWA (Progressive Web App):**
- Funziona su qualsiasi browser senza installazione da store
- Si può installare come app nativa su iPhone, Android e PC
- Funziona anche offline per le operazioni di base (cache service worker)
- Un solo codebase per tutti i dispositivi

### 4.5 Database — SQLite

**Perché SQLite:**
- File singolo, zero configurazione, zero RAM aggiuntiva
- Usato per: link di condivisione, sessioni utente, storico notifiche
- Non serve un container separato (es. PostgreSQL o MySQL)

### 4.6 Notifiche — Web Push + Email SMTP

Due canali paralleli per le notifiche:

- **Web Push:** notifiche native del browser/telefono. Funziona su Android (Chrome),
  desktop (Chrome, Firefox, Edge), iPhone solo se la PWA è installata (iOS 16.4+)
- **Email SMTP:** più affidabile, arriva sempre. Si configura con qualsiasi account
  email (Gmail, iCloud, Outlook, provider custom)

---

## 5. Funzionalità dell'applicazione

### 5.1 File Manager
- Navigazione cartelle con albero laterale e breadcrumb
- Vista griglia (icone) e lista (dettagli)
- Ordinamento per nome, data, dimensione, tipo
- Operazioni: copia, taglia, incolla, rinomina, elimina, nuova cartella
- Upload drag & drop (anche multiple file)
- Upload foto direttamente da fotocamera del telefono
- Download singolo file e download multiplo come ZIP
- Anteprima immagini, documenti PDF, file di testo

### 5.2 Streaming Media
- Riproduzione video direttamente nel browser (MP4, MKV, AVI con transcoding)
- Riproduzione audio (MP3, FLAC, AAC)
- Player con controlli completi: play/pausa, avanzamento, volume, fullscreen
- Supporto range requests (seek nel video senza riscaricare tutto)

### 5.3 Condivisione Link
- Generazione link pubblici per singoli file o cartelle
- Opzione password sul link
- Opzione scadenza (es. link valido 24h / 7 giorni / 30 giorni / mai)
- Pagina di download pubblica senza login
- Elenco link attivi con possibilità di revocarli

### 5.4 Monitoraggio e Notifiche
- Dashboard con stato del NAS in tempo reale:
  - Spazio usato / disponibile per ogni volume
  - Stato SMART dei dischi (salute, temperatura, ore di utilizzo)
  - Utilizzo CPU e RAM
  - Traffico di rete
- Alert automatici via Push e/o Email per:
  - Stato SMART degradato o errori disco
  - Temperatura disco sopra soglia (configurabile, default 55°C)
  - Spazio occupato oltre soglia (configurabile, default 80% e 90%)
  - App riavviata dopo un crash

### 5.5 Pannello Admin
- Visualizzazione log applicazione
- Riavvio manuale del servizio backend
- Configurazione soglie di alert
- Gestione link di condivisione attivi
- Cambio password di accesso all'app

### 5.6 Gestione riavvii
- `restart: always` su tutti i container Docker: l'app riparte automaticamente
  dopo un crash o dopo un riavvio del NAS
- Riavvio manuale disponibile dal pannello admin dell'interfaccia web

---

## 6. Sicurezza

### 6.1 Autenticazione
- Login separato dall'account QNAP (credenziali definite in `.env`)
- Sessioni gestite con JWT (JSON Web Token):
  - Access token: scade dopo 15 minuti
  - Refresh token: scade dopo 7 giorni, salvato in cookie HttpOnly
- Password salvata come hash bcrypt (non in chiaro)

### 6.2 Protezione brute force
- Rate limiting sul login: max 10 tentativi per 15 minuti per IP
- Dopo 10 tentativi falliti: blocco temporaneo con risposta ritardata

### 6.3 Sicurezza HTTP
- Header di sicurezza via Helmet.js:
  - `Strict-Transport-Security` (forza HTTPS)
  - `X-Content-Type-Options`
  - `X-Frame-Options` (blocca iframe esterni)
  - `Content-Security-Policy`
- CORS configurato solo per il dominio Cloudflare dell'app
- Cookie con flag `Secure`, `HttpOnly`, `SameSite=Strict`

### 6.4 Validazione input
- Tutti i path di file e cartelle vengono sanificati per prevenire path traversal
  (es. tentativi di accedere a `../../etc/passwd`)
- Dimensione massima upload configurabile (default 10 GB)
- Tipo MIME verificato lato server per i file caricati

### 6.5 Credenziali QNAP
- Le credenziali QNAP sono salvate solo nel file `.env` sul NAS
- Non escono mai verso il browser
- Il backend mantiene la sessione QNAP internamente e la rinnova automaticamente

### 6.6 Link di condivisione
- Token generati crittograficamente (crypto.randomBytes)
- Link con password: hash bcrypt separato per ogni link
- Link scaduti eliminati automaticamente dal database

### 6.7 Cloudflare
- Il traffico da internet passa sempre da Cloudflare (HTTPS obbligatorio)
- Il NAS non è raggiungibile direttamente da internet (nessuna porta aperta)
- Cloudflare WAF (Web Application Firewall) di base incluso nel piano gratuito

---

## 7. Software di terze parti da installare

### 7.1 Container Station (sul QNAP)

**Cos'è:** applicazione QNAP che permette di eseguire container Docker sul NAS.

**Come installarlo:**
1. Accedere all'interfaccia web del QNAP dalla rete locale (es. `http://192.168.1.X:8080`)
2. Aprire **App Center** (icona store nella barra in alto)
3. Cercare **"Container Station"**
4. Cliccare **Installa** → confermare
5. Attendere il completamento (2-5 minuti)
6. Container Station apparirà nel menu principale del QNAP

**Requisiti:** QTS 4.3.3 o superiore (il TS-231P2 lo supporta), connessione internet

**Costo:** Gratuito

---

### 7.2 Account Cloudflare + cloudflared (per accesso remoto)

**Cos'è:** Cloudflare è un servizio internet che offre tunnel sicuri gratuiti.
`cloudflared` è il programma client che gira sul QNAP e mantiene il tunnel aperto.

**Passaggi per configurare Cloudflare Tunnel:**

**Passo A — Creare account Cloudflare:**
1. Andare su `https://dash.cloudflare.com/sign-up`
2. Registrarsi con email e password (piano Free, nessuna carta di credito)
3. Verificare l'email

**Passo B — Aggiungere un dominio (opzionale ma consigliato):**
- Se hai già un dominio (es. acquistato su Namecheap, GoDaddy, ecc.):
  1. In Cloudflare dashboard → **Add a Site** → inserire il dominio
  2. Seguire le istruzioni per cambiare i nameserver del dominio verso Cloudflare
  3. Attendere propagazione (15 minuti - 24 ore)
- Se non hai un dominio: Cloudflare assegna un sottodominio gratuito
  tipo `qualcosa.trycloudflare.com` (meno professionale ma funziona)

**Passo C — Creare il Tunnel:**
1. In Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels**
2. Cliccare **Create a tunnel** → scegliere **Cloudflared**
3. Dare un nome al tunnel (es. `qnap-nas`)
4. Cloudflare mostrerà un token lungo (es. `eyJhIjoiMT...`) — **copiarlo**,
   servirà nel file di configurazione dell'app

**Passo D — Configurare il routing:**
1. Nella stessa pagina, sotto **Public Hostname**:
   - Subdomain: `nas` (o quello che preferisci)
   - Domain: il tuo dominio (es. `miodominio.it`)
   - Service: `http://nas-app:3000` (indirizzo interno Docker)
2. Salvare

`cloudflared` girerà come container Docker insieme all'app e si connette
automaticamente a Cloudflare usando il token. Non serve aprire porte sul router.

**Costo:** Gratuito

---

### 7.3 Account email SMTP (per notifiche email)

**Cos'è:** un account email usato dall'app per inviare notifiche automatiche.

**Opzione consigliata — Gmail con App Password:**
1. Avere un account Gmail (o crearne uno dedicato, es. `notifiche.nas@gmail.com`)
2. Attivare la verifica in due passaggi sull'account Gmail
   (Impostazioni Google → Sicurezza → Verifica in due passaggi)
3. Generare una **App Password**:
   - Impostazioni Google → Sicurezza → App Password
   - Scegliere "Altra app" → nome "NAS App" → Genera
   - Copiare la password di 16 caratteri generata
4. Inserire email e App Password nel file `.env` dell'applicazione

**Opzioni alternative:**
- **iCloud Mail:** supporta SMTP con App Password (simile a Gmail)
- **Outlook/Hotmail:** supporta SMTP, credenziali standard
- **Provider custom:** se hai un dominio email proprio, usare le credenziali SMTP
  del provider (Aruba, Register.it, ecc.)

**Costo:** Gratuito (con account email già esistente)

---

### 7.4 Nessun software da installare sul telefono/PC client

L'applicazione è una **PWA (Progressive Web App)**. Per usarla:
- Aprire il browser (Chrome, Safari, Firefox, Edge)
- Navigare all'URL del proprio tunnel Cloudflare (es. `https://nas.miodominio.it`)
- Fare login

**Per installarla come app (opzionale):**
- **Android (Chrome):** toccare i tre puntini → "Aggiungi alla schermata Home"
- **iPhone/iPad (Safari):** toccare l'icona condividi → "Aggiungi a schermata Home"
  (iOS 16.4+ per le notifiche push)
- **PC Chrome/Edge:** icona di installazione nella barra degli indirizzi

---

## 8. Stack tecnologico completo

| Componente | Tecnologia | Versione |
|---|---|---|
| Backend | Node.js + Express | Node 18 LTS (Alpine ARM) |
| Frontend | React + Vite | React 18, Vite 5 |
| Database | SQLite (better-sqlite3) | 3.x |
| Autenticazione | JWT (jsonwebtoken) + bcrypt | — |
| Sicurezza HTTP | Helmet.js | — |
| Rate limiting | express-rate-limit | — |
| Upload file | Multer | — |
| Email | Nodemailer | — |
| Notifiche Push | web-push | — |
| Container | Docker (ARM linux/arm/v7) | — |
| Tunnel | cloudflared | latest |
| Accesso remoto | Cloudflare Tunnel | Free plan |

---

## 9. Struttura file del progetto

```
nas-app/
├── docker-compose.yml          # avvia tutto con un comando
├── .env.example                # template variabili di configurazione
├── PROGETTO.md                 # questo documento
├── SETUP.md                    # guida installazione passo-passo
│
├── backend/
│   ├── Dockerfile              # immagine ARM Node.js
│   ├── package.json
│   ├── server.js               # entry point
│   ├── lib/
│   │   ├── qnap.js             # client API QNAP
│   │   ├── db.js               # gestione SQLite
│   │   └── notifications.js    # push + email
│   ├── middleware/
│   │   ├── auth.js             # verifica JWT
│   │   └── rateLimiter.js      # rate limiting
│   └── routes/
│       ├── auth.js             # login, refresh, logout
│       ├── files.js            # file manager operations
│       ├── stream.js           # streaming media
│       ├── share.js            # link di condivisione
│       ├── system.js           # stato NAS, notifiche
│       └── admin.js            # pannello admin
│
└── frontend/
    ├── Dockerfile              # build + serve statico
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── public/
    │   ├── manifest.json       # configurazione PWA
    │   └── sw.js               # service worker (offline + notifiche)
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        │   └── client.js       # axios con interceptor JWT
        ├── hooks/
        │   ├── useAuth.js
        │   └── useFiles.js
        └── components/
            ├── Login.jsx
            ├── Layout.jsx
            ├── FileBrowser.jsx
            ├── FileItem.jsx
            ├── UploadZone.jsx
            ├── MediaPlayer.jsx
            ├── ShareModal.jsx
            ├── SystemDashboard.jsx
            └── AdminPanel.jsx
```

---

## 10. Variabili di configurazione (.env)

```env
# Porta su cui gira il backend dentro Docker
PORT=3000

# Credenziali di accesso all'app (NON le credenziali QNAP)
APP_USERNAME=admin
APP_PASSWORD=scegliere_una_password_sicura

# Segreto per firmare i JWT (stringa casuale lunga almeno 32 caratteri)
JWT_SECRET=cambiare_con_stringa_casuale_lunga

# Credenziali QNAP (usate solo dal backend, mai esposte al browser)
QNAP_HOST=http://192.168.1.X    # IP del NAS nella rete locale
QNAP_PORT=8080                   # porta admin QNAP (default 8080)
QNAP_USERNAME=admin              # utente QNAP
QNAP_PASSWORD=password_qnap

# Email per notifiche
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifiche.nas@gmail.com
SMTP_PASS=app_password_gmail_16_caratteri
NOTIFY_TO=tua.email@gmail.com

# Cloudflare Tunnel token (ottenuto dal dashboard Cloudflare)
CLOUDFLARE_TOKEN=eyJhIjoiMT...

# Soglie di alert
ALERT_STORAGE_WARN=80            # % spazio → warning
ALERT_STORAGE_CRIT=90            # % spazio → critical
ALERT_TEMP_WARN=55               # °C temperatura disco → warning
```

---

## 11. Limiti e note importanti

- **Transcoding video:** il TS-231P2 non ha accelerazione hardware per il transcoding.
  I formati MP4 (H.264) e audio MP3/AAC vengono riprodotti direttamente dal browser
  senza transcoding. Formati come MKV con codec non supportati potrebbero non riprodursi.
  Una soluzione futura sarebbe aggiungere FFmpeg per il transcoding software, ma
  consumerebbe molta CPU su questo hardware.

- **RAM:** il TS-231P2 ha 1 GB di RAM. L'app è progettata per essere leggera
  (Node.js Alpine + SQLite). Non aggiungere altri container pesanti.

- **Utenti multipli:** nella versione attuale c'è un solo utente admin. Supporto
  multi-utente può essere aggiunto in futuro.

- **Backup configurazione:** il file `.env` e il database SQLite (`data/db.sqlite`)
  vanno inclusi nei backup del NAS. Senza `.env` non è possibile riaccedere all'app.
```
