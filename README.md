# Smart Home — piano presenze di casa

Calendario mensile per segnare con un tap i giorni di **smart working 🏠**, **presenza 🏢**, **L. 104** e **ferie 🌴** di Max e Vale, con note per ogni giorno e invio del piano su WhatsApp.

## Come si usa

- **In basso** scegli *chi* (Max / Vale / Entrambi) e *cosa* (Smart / Presenza / L. 104 / Ferie / Togli / Note).
- **Tocca un giorno** e la scelta viene segnata. Se tocchi di nuovo con la stessa scelta, il giorno torna vuoto.
- **Tieni premuto** su un giorno (oppure scegli 📝 Note) per aprire il dettaglio: qui scrivi le note (visite, appuntamenti, orari) e cambi lo stato di tutti e due.
- **Scorri di lato** sul calendario oppure usa ‹ › per cambiare mese.
- **⚙️ Settimana tipo**: puoi impostare *Una settimana* oppure *Due alternate (A/B)*. Con **Modello 3+2** la settimana A ha lunedì, mercoledì e venerdì in smart, la B martedì e giovedì; i giorni si possono comunque cambiare toccandoli. Scegli da quale lunedì parte la settimana A e fino a quando ripetere (1-12 mesi o 31 dicembre), poi premi *Applica*. Ferie, L. 104, festivi e note non vengono mai toccati; Smart e Presenza già segnati si sostituiscono solo se metti la spunta.
- **WhatsApp**: manda questa settimana, la prossima o tutto il mese, con le note.
- Il pallino accanto al titolo è **verde** quando i dati sono condivisi, **arancione** quando sei senza rete (le modifiche partono appena torna la connessione).

## 1. Supabase (una volta sola)

`config.js` usa già il progetto Supabase di CheManca, quindi basta creare la tabella:

1. Apri https://supabase.com/dashboard e poi il progetto di CheManca.
2. Nel menu a sinistra apri **SQL Editor** e scegli **New query**.
3. Incolla tutto il contenuto di `schema.sql` e premi **Run**.

Così nasce la tabella `sh_giorni`, accanto a quelle di CheManca, senza toccarle. Se esce una nuova versione di `schema.sql`, basta rieseguirlo: non cancella i dati.

## 2. GitHub Pages

1. Su https://github.com, entrando come **maxautapp**: **+** in alto a destra, poi **New repository**.
2. Come nome metti `SmartHome`, scegli **Public** e premi **Create repository**.
3. Nella pagina del repo vuoto clicca **uploading an existing file**.
4. Trascina tutti i file della cartella `smart-home` (non la cartella stessa) e premi **Commit changes**.
5. Apri **Settings**, poi **Pages**. Sotto *Branch* scegli `main` e `/ (root)` e premi **Save**.
6. Dopo 1-2 minuti l'app è online su **https://maxautapp.github.io/SmartHome/**

Per aggiornarla in futuro: nel repo premi **Add file**, poi **Upload files**, trascina i file cambiati e premi **Commit**.

## 3. Sul telefono

Apri il link su tutti e due i telefoni e aggiungi l'app alla schermata Home:
- **Android (Chrome)**: menu ⋮, poi *Aggiungi a schermata Home*.
- **iPhone (Safari)**: tasto Condividi, poi *Aggiungi alla schermata Home*.

## Note

- Chiunque abbia il link può modificare il piano: è lo stesso livello di protezione di CheManca. Non diffondere il link fuori dalla famiglia.
- Nomi e santo patrono si cambiano in `config.js` (`PERSONE`, `PATRONO`).
