-- ============================================================
--  Smart Home - tabella del piano presenze (Supabase / PostgreSQL)
--  Copia TUTTO e incollalo in Supabase > SQL Editor > Run.
--  Si può rieseguire senza danni.
-- ============================================================

-- una riga per giorno e per persona: dove lavora e l'eventuale nota
create table if not exists sh_giorni (
  data       date not null,
  persona    text not null,                 -- max | vale (gli id di config.js)
  stato      text,                          -- smart | ufficio (= presenza) | l104 | ferie
  nota       text,
  aggiornato timestamptz default now(),
  primary key (data, persona)
);

-- stati ammessi (rieseguire lo script aggiorna anche le tabelle già create)
alter table sh_giorni drop constraint if exists sh_giorni_stato_check;
alter table sh_giorni add constraint sh_giorni_stato_check
  check (stato in ('smart','ufficio','l104','ferie'));

-- accesso libero con la chiave pubblica (come CheManca): chi ha il link può modificare
alter table sh_giorni enable row level security;
drop policy if exists "accesso app" on sh_giorni;
create policy "accesso app" on sh_giorni for all using (true) with check (true);

-- aggiornamento in tempo reale sull'altro telefono
alter table sh_giorni replica identity full;
do $$ begin
  alter publication supabase_realtime add table sh_giorni;
exception when duplicate_object then null;
end $$;
