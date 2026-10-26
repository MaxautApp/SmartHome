/* Smart Home - impostazioni. La chiave "publishable" di Supabase è pubblica per natura:
   può stare qui. Se SUPABASE_URL resta vuoto l'app funziona lo stesso, ma solo su questo telefono. */
window.CONFIG = {
  // Stesso progetto Supabase di CheManca: basta eseguire schema.sql una volta.
  SUPABASE_URL: "https://sguuanwrvybpqiljjirm.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_6cX31JI7THOccwZkjqJ6ww_seThPY9E",

  // Le due persone del piano (id breve, senza spazi: non cambiarlo dopo aver iniziato)
  PERSONE: [
    { id: "max", nome: "Max" },
    { id: "vale", nome: "Vale" },
  ],

  // Santo patrono della vostra città, "MM-GG" (es. "06-24" per Torino). Vuoto = nessuno.
  PATRONO: "",
};
