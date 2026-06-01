# 🍕 Pizzeria Bella Napoli

Applicazione web completa per una pizzeria, con **lato cliente** (ordini e pagamento)
e **lato amministratore** (gestione ordini e menu). Funziona su **telefono e PC**.

- Backend: **Node.js + Express**
- Database: **SQLite** (file locale `pizzeria.db`, nessuna installazione esterna)
- Autenticazione: **JWT** con ruoli `user` / `admin`
- Pagamenti: **contanti** alla consegna + **carta (Stripe simulato)**

---

## ▶️ Avvio rapido

Servono solo **Node.js 18+** (già presente sul tuo PC: v22).

```bash
npm install      # installa le dipendenze (già fatto)
npm start        # avvia il server
```

Poi apri il browser:

| Cosa | Indirizzo |
|------|-----------|
| 🛒 Sito clienti | http://localhost:3000 |
| 👨‍🍳 Pannello admin | http://localhost:3000/admin |

Al primo avvio il database viene creato e popolato automaticamente con
18 pizze, un account admin e un utente demo.

### Account già pronti

| Ruolo | Email | Password |
|-------|-------|----------|
| **Admin** | `admin@pizzeria.it` | `admin123` |
| **Cliente demo** | `mario@example.com` | `mario123` |

Puoi anche **registrare** un nuovo cliente dal sito.

---

## 🌐 Pubblicare online (Render)

Il sito è pronto per essere pubblicato **gratis** su **[Render](https://render.com)**,
che esegue Node.js e il database (a differenza di GitHub Pages, che ospita solo file statici).

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/proismamaster/pizzeriaTesting)

**Passaggi:**

1. Clicca il pulsante qui sopra (oppure su Render: **New +** → **Blueprint**).
2. Accedi con **GitHub** e autorizza Render ad accedere al repository.
3. Render legge il file [`render.yaml`](render.yaml) e configura tutto da solo:
   build (`npm install`), avvio (`npm start`) e un `JWT_SECRET` generato in automatico.
4. *(Consigliato)* Imposta la variabile **`ADMIN_PASSWORD`** con una password a tua
   scelta. Se la lasci vuota viene usata quella di default (`admin123`).
5. Clicca **Apply** e attendi qualche minuto: otterrai un link pubblico, tipo
   `https://pizzeria-bella-napoli.onrender.com`.

> ℹ️ **Piano gratuito:** il servizio va in pausa dopo ~15 minuti di inattività e
> si riattiva al primo accesso (qualche secondo). Il database SQLite è temporaneo
> e si ripopola da solo (menu, admin, demo) a ogni riavvio — perfetto per una demo.

---

## 💳 Come provare il pagamento con carta

Nel checkout scegli **"Carta di credito"** e usa una di queste carte di test
(cliccabili direttamente nella finestra di pagamento):

| Numero carta | Esito |
|--------------|-------|
| `4242 4242 4242 4242` | ✅ Pagamento approvato |
| `4000 0000 0000 0002` | ❌ Carta rifiutata |
| `4000 0000 0000 9995` | ❌ Fondi insufficienti |

Scadenza: una qualsiasi futura (es. `12/27`) · CVC: 3 cifre (es. `123`).

> ⚠️ I pagamenti sono **simulati**: nessun addebito reale e nessun dato inviato a
> server esterni. Il codice è già predisposto per collegare lo Stripe vero
> (vedi i commenti in [`payments.js`](payments.js)).

---

## 🔁 Il flusso completo

1. Il **cliente** sfoglia il menu, aggiunge pizze al carrello e va al checkout.
2. Sceglie **contanti** o **carta** e conferma l'ordine.
3. L'ordine viene salvato nel database con stato **"Ricevuto"**.
4. Nel **pannello admin** l'ordine compare **automaticamente** (con suono e notifica).
5. L'admin avanza lo stato: Ricevuto → In preparazione → In consegna → Consegnato.
6. Il cliente vede lo stato aggiornarsi nella sezione **"I miei ordini"**.

---

## ✨ Funzionalità

**Lato cliente**
- Registrazione e login
- Menu con categorie, ricerca e schede pizza
- Carrello persistente (resta anche se ricarichi la pagina)
- Checkout con dati di consegna salvati nel profilo
- Pagamento contanti o carta (finestra in stile Stripe)
- Storico ordini con barra di avanzamento dello stato
- Profilo modificabile

**Lato admin**
- Dashboard con statistiche (ordini e incassi)
- Elenco ordini in tempo reale con notifica dei nuovi ordini
- Filtro per stato e avanzamento con un clic
- Segna come pagato gli ordini in contanti
- Gestione completa del menu (aggiungi, modifica, attiva/disattiva, elimina)

**Tecniche**
- Design responsive (mobile-first) con barra di navigazione mobile
- Password cifrate (bcrypt), API protette per ruolo
- Prezzi gestiti in centesimi (niente errori di arrotondamento)

---

## 🛠️ Comandi utili

```bash
npm start            # avvia in produzione
npm run dev          # avvia con riavvio automatico ad ogni modifica
npm run seed         # ripopola il menu se il database è vuoto
npm run reset        # AZZERA il database e lo ripopola da zero
```

Per cambiare porta, credenziali admin o costi di consegna, modifica
[`config.js`](config.js) (oppure usa le variabili d'ambiente).

---

## 📁 Struttura del progetto

```
Pizzeria/
├── server.js        API REST + avvio server
├── db.js            connessione SQLite + schema tabelle
├── seed.js          dati iniziali (pizze, admin, demo)
├── auth.js          token JWT e protezione delle rotte
├── payments.js      simulatore pagamento carta (stile Stripe)
├── config.js        configurazione (porta, segreti, consegna)
└── public/
    ├── index.html   sito clienti
    ├── admin.html   pannello amministratore
    ├── css/style.css
    └── js/          common.js · app.js · admin.js
```
