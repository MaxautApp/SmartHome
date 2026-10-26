/* Smart Home - piano presenze di casa: smart working, presenza, L. 104, ferie e note per ogni giorno.
   Dati condivisi su Supabase (tabella sh_giorni), copia in localStorage per aprire subito e senza rete. */
(() => {
  "use strict";
  const CFG = window.CONFIG || {};
  const PERSONE = CFG.PERSONE?.length ? CFG.PERSONE : [{ id: "io", nome: "Io" }];
  const STATI = {
    smart: { nome: "Smart", ic: "🏠" },
    ufficio: { nome: "Presenza", ic: "🏢" }, // id "ufficio" tenuto per i dati già salvati
    l104: { nome: "L. 104", ic: "❤️" },
    ferie: { nome: "Ferie", ic: "🌴" },
  };
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const GG = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const GG_LUNGHI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

  // sigla nella cella: l'iniziale, o due lettere se due nomi iniziano uguale
  const iniziali = PERSONE.map((p) => p.nome[0].toUpperCase());
  const sigla = (p, i) => (iniziali.filter((x) => x === iniziali[i]).length > 1 ? p.nome.slice(0, 2) : iniziali[i]);

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const leggiLS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const scriviLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const daIso = (s) => { const [a, m, g] = s.split("-").map(Number); return new Date(a, m - 1, g); };
  const chiave = (data, persona) => `${data}|${persona}`;

  /* ---------- festività italiane ---------- */
  function pasqua(a) { // algoritmo di Meeus/Jones/Butcher
    const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4;
    const g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
    const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4;
    const m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
    const mese = Math.floor((i + m - 7 * n + 114) / 31), giorno = ((i + m - 7 * n + 114) % 31) + 1;
    return new Date(a, mese - 1, giorno);
  }
  const festeCache = {};
  function feste(anno) {
    if (festeCache[anno]) return festeCache[anno];
    const f = {
      "01-01": "Capodanno", "01-06": "Epifania", "04-25": "Festa della Liberazione", "05-01": "Festa del Lavoro",
      "06-02": "Festa della Repubblica", "08-15": "Ferragosto", "11-01": "Ognissanti", "12-08": "Immacolata",
      "12-25": "Natale", "12-26": "Santo Stefano",
    };
    if (CFG.PATRONO) f[CFG.PATRONO] = "Santo Patrono";
    const p = pasqua(anno), pm = new Date(p); pm.setDate(p.getDate() + 1);
    f[iso(p).slice(5)] = "Pasqua"; f[iso(pm).slice(5)] = "Pasquetta";
    return (festeCache[anno] = f);
  }
  const festa = (data) => feste(Number(data.slice(0, 4)))[data.slice(5)] || "";

  /* ---------- stato dell'app ---------- */
  const dati = new Map(leggiLS("sh_cache", []).map((r) => [chiave(r.data, r.persona), r]));
  let coda = leggiLS("sh_coda", []); // modifiche non ancora arrivate a Supabase
  const pref = Object.assign({ chi: PERSONE[0].id, pennello: "smart", tipo: {} }, leggiLS("sh_pref", {}));
  const oggi = new Date();
  let anno = oggi.getFullYear(), mese = oggi.getMonth();
  const salvaCache = () => scriviLS("sh_cache", [...dati.values()]);
  const salvaPref = () => scriviLS("sh_pref", pref);
  const voce = (data, persona) => dati.get(chiave(data, persona)) || { data, persona, stato: null, nota: "" };

  /* ---------- Supabase ---------- */
  const sb = CFG.SUPABASE_URL && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY) : null;
  function segnaSync(stato) {
    const el = $("#sync");
    el.className = "sync " + stato;
    el.title = { ok: "Condiviso: le modifiche arrivano sull'altro telefono", off: "Senza rete: salvo appena torna", locale: "Solo su questo telefono (Supabase non configurato)" }[stato];
  }
  async function carica() {
    if (!sb) return segnaSync("locale");
    try {
      await svuotaCoda();
      const { data, error } = await sb.from("sh_giorni").select("data,persona,stato,nota");
      if (error) throw error;
      dati.clear();
      for (const r of data) dati.set(chiave(r.data, r.persona), r);
      // le modifiche ancora in coda vincono su quello che arriva
      for (const r of coda) applicaLocale(r);
      salvaCache(); disegna(); segnaSync(coda.length ? "off" : "ok");
    } catch (e) { console.warn(e); segnaSync("off"); }
  }
  function ascolta() {
    if (!sb) return;
    sb.channel("sh_giorni").on("postgres_changes", { event: "*", schema: "public", table: "sh_giorni" }, (p) => {
      if (p.eventType === "DELETE") dati.delete(chiave(p.old.data, p.old.persona));
      else dati.set(chiave(p.new.data, p.new.persona), { data: p.new.data, persona: p.new.persona, stato: p.new.stato, nota: p.new.nota });
      salvaCache(); disegna();
    }).subscribe();
  }
  const vuota = (r) => !r.stato && !(r.nota || "").trim();
  function applicaLocale(r) {
    if (vuota(r)) dati.delete(chiave(r.data, r.persona));
    else dati.set(chiave(r.data, r.persona), { data: r.data, persona: r.persona, stato: r.stato || null, nota: (r.nota || "").trim() });
  }
  async function svuotaCoda() {
    if (!sb || !coda.length) return;
    const lotto = coda.slice();
    const da_togliere = lotto.filter(vuota), da_scrivere = lotto.filter((r) => !vuota(r))
      .map((r) => ({ data: r.data, persona: r.persona, stato: r.stato || null, nota: (r.nota || "").trim() || null, aggiornato: new Date().toISOString() }));
    if (da_scrivere.length) {
      const { error } = await sb.from("sh_giorni").upsert(da_scrivere, { onConflict: "data,persona" });
      if (error) throw error;
    }
    for (const r of da_togliere) {
      const { error } = await sb.from("sh_giorni").delete().eq("data", r.data).eq("persona", r.persona);
      if (error) throw error;
    }
    coda = coda.filter((c) => !lotto.includes(c)); scriviLS("sh_coda", coda);
  }
  // salva una o più voci: subito a video, poi verso Supabase
  async function salva(righe) {
    for (const r of righe) {
      applicaLocale(r);
      coda = coda.filter((c) => chiave(c.data, c.persona) !== chiave(r.data, r.persona));
      coda.push({ data: r.data, persona: r.persona, stato: r.stato || null, nota: r.nota || "" });
    }
    scriviLS("sh_coda", coda); salvaCache(); disegna();
    if (!sb) { coda = []; scriviLS("sh_coda", coda); return; }
    try { await svuotaCoda(); segnaSync("ok"); } catch (e) { console.warn(e); segnaSync("off"); avviso("Senza rete: salvo appena torna"); }
  }
  window.addEventListener("online", () => carica());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) carica(); });

  /* ---------- calendario ---------- */
  function disegna() {
    $("#nomeMese").textContent = `${MESI[mese]} ${anno}`;
    const primo = new Date(anno, mese, 1), giorni = new Date(anno, mese + 1, 0).getDate();
    const vuoti = (primo.getDay() + 6) % 7, oggiIso = iso(oggi);
    let h = "";
    for (let i = 0; i < vuoti; i++) h += `<div class="cella vuota"></div>`;
    for (let g = 1; g <= giorni; g++) {
      const d = new Date(anno, mese, g), data = iso(d), dow = d.getDay(), fe = festa(data);
      const cls = ["cella", dow === 0 || dow === 6 ? "we" : "", dow === 0 ? "dom" : "", fe ? "festa" : "", data === oggiIso ? "oggi" : ""].join(" ");
      const note = PERSONE.some((p) => voce(data, p.id).nota);
      const righe = PERSONE.map((p, i) => {
        const s = voce(data, p.id).stato;
        return `<span class="riga ${s || ""}"><span>${esc(sigla(p, i))}</span><span class="ic">${s ? STATI[s].ic : ""}</span></span>`;
      }).join("");
      h += `<button class="${cls}" data-data="${data}" title="${esc(fe)}"><span class="num">${g}${note ? '<span class="notina">📝</span>' : ""}</span>${righe}</button>`;
    }
    $("#griglia").innerHTML = h;
    disegnaRiepilogo(giorni);
    disegnaNote(giorni);
    disegnaBarra();
  }
  function disegnaRiepilogo(giorni) {
    const conta = Object.fromEntries(PERSONE.map((p) => [p.id, Object.fromEntries(Object.keys(STATI).map((k) => [k, 0]))]));
    let insieme = 0;
    for (let g = 1; g <= giorni; g++) {
      const data = iso(new Date(anno, mese, g));
      let tutti = true;
      for (const p of PERSONE) { const s = voce(data, p.id).stato; if (s) conta[p.id][s]++; if (s !== "smart") tutti = false; }
      if (tutti && PERSONE.length > 1) insieme++;
    }
    $("#riepilogo").innerHTML = PERSONE.map((p) => `<div class="ri-persona"><b>${esc(p.nome)}</b>` +
      Object.entries(STATI).map(([k, s]) => `<span class="pill ${k}" title="${s.nome}">${s.ic} ${conta[p.id][k]}</span>`).join("") + `</div>`).join("") +
      (PERSONE.length > 1 ? `<div class="ri-insieme">🏡 A casa insieme in smart: <b>${insieme}</b> ${insieme === 1 ? "giorno" : "giorni"}</div>` : "");
  }
  function disegnaNote(giorni) {
    const voci = [];
    for (let g = 1; g <= giorni; g++) {
      const data = iso(new Date(anno, mese, g));
      for (const p of PERSONE) { const n = voce(data, p.id).nota; if (n) voci.push({ data, g, p, n }); }
    }
    $("#listaNote").innerHTML = voci.length ? voci.map((v) =>
      `<li data-data="${v.data}"><span class="quando">${GG[daIso(v.data).getDay()]} ${v.g} · ${esc(v.p.nome)}</span>${esc(v.n).replace(/\n/g, "<br>")}</li>`).join("")
      : `<li class="vuoto">Nessuna nota questo mese. Tieni premuto su un giorno per aggiungerne una.</li>`;
  }

  /* ---------- barra: chi e cosa ---------- */
  const PENNELLI = [
    { id: "smart", ic: "🏠", nome: "Smart" }, { id: "ufficio", ic: "🏢", nome: "Presenza" },
    { id: "l104", ic: "❤️", nome: "L. 104" },
    { id: "ferie", ic: "🌴", nome: "Ferie" }, { id: "togli", ic: "✖️", nome: "Togli" }, { id: "nota", ic: "📝", nome: "Note" },
  ];
  function disegnaBarra() {
    const chi = PERSONE.length > 1 ? [...PERSONE, { id: "tutti", nome: "Entrambi" }] : PERSONE;
    $("#chi").innerHTML = chi.map((p) => `<button data-chi="${p.id}" class="${pref.chi === p.id ? "attivo" : ""}">${esc(p.nome)}</button>`).join("");
    $("#pennelli").innerHTML = PENNELLI.map((b) => `<button data-pennello="${b.id}" class="${b.id} ${pref.pennello === b.id ? "attivo" : ""}"><span class="ic">${b.ic}</span>${b.nome}</button>`).join("");
  }
  $("#chi").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; pref.chi = b.dataset.chi; salvaPref(); disegnaBarra(); });
  $("#pennelli").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; pref.pennello = b.dataset.pennello; salvaPref(); disegnaBarra(); });

  // tap = applica il pennello; tocca di nuovo lo stesso = toglie. Pressione lunga = dettaglio.
  function tocca(data) {
    if (pref.pennello === "nota") return apriGiorno(data);
    const chi = pref.chi === "tutti" ? PERSONE : PERSONE.filter((p) => p.id === pref.chi);
    if (!chi.length) return;
    const nuovo = pref.pennello === "togli" ? null : pref.pennello;
    const giaTutti = nuovo && chi.every((p) => voce(data, p.id).stato === nuovo);
    salva(chi.map((p) => ({ ...voce(data, p.id), stato: giaTutti ? null : nuovo })));
    if (navigator.vibrate) navigator.vibrate(12);
  }
  let timer = null, lungo = false;
  const griglia = $("#griglia");
  griglia.addEventListener("pointerdown", (e) => {
    const c = e.target.closest(".cella[data-data]"); if (!c) return;
    lungo = false; clearTimeout(timer);
    timer = setTimeout(() => { lungo = true; if (navigator.vibrate) navigator.vibrate(25); apriGiorno(c.dataset.data); }, 500);
  });
  ["pointerup", "pointerleave", "pointercancel", "scroll"].forEach((ev) => griglia.addEventListener(ev, () => clearTimeout(timer)));
  window.addEventListener("scroll", () => clearTimeout(timer), { passive: true });
  griglia.addEventListener("contextmenu", (e) => e.preventDefault());
  griglia.addEventListener("click", (e) => {
    const c = e.target.closest(".cella[data-data]"); if (!c) return;
    if (lungo) { lungo = false; return; }
    tocca(c.dataset.data);
  });
  $("#listaNote").addEventListener("click", (e) => { const li = e.target.closest("li[data-data]"); if (li) apriGiorno(li.dataset.data); });

  /* ---------- dettaglio del giorno ---------- */
  let bozza = null;
  function apriGiorno(data) {
    const d = daIso(data);
    bozza = { data, voci: PERSONE.map((p) => ({ ...voce(data, p.id) })) };
    $("#dgTitolo").textContent = `${GG_LUNGHI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
    $("#dgFesta").textContent = festa(data) ? "🎉 " + festa(data) : "";
    $("#dgPersone").innerHTML = PERSONE.map((p, i) => `<div class="persona-box" data-i="${i}">
      <h4>${esc(p.nome)}</h4>
      <div class="stati">${Object.entries(STATI).map(([k, s]) => `<button type="button" data-stato="${k}" class="${k}"><span class="ic">${s.ic}</span>${s.nome}</button>`).join("")}
        <button type="button" data-stato="" class="nessuno"><span class="ic">—</span>Niente</button></div>
      <textarea placeholder="Note: visite, appuntamenti, orari…" data-i="${i}">${esc(bozza.voci[i].nota)}</textarea></div>`).join("");
    segnaStatiBozza();
    $("#dlgGiorno").showModal();
  }
  function segnaStatiBozza() {
    document.querySelectorAll("#dgPersone .persona-box").forEach((box) => {
      const s = bozza.voci[box.dataset.i].stato || "";
      box.querySelectorAll(".stati button").forEach((b) => b.classList.toggle("attivo", b.dataset.stato === s));
    });
  }
  $("#dgPersone").addEventListener("click", (e) => {
    const b = e.target.closest(".stati button"); if (!b) return;
    bozza.voci[b.closest(".persona-box").dataset.i].stato = b.dataset.stato || null;
    segnaStatiBozza();
  });
  $("#dlgGiorno").addEventListener("close", () => {
    if ($("#dlgGiorno").returnValue !== "salva" || !bozza) return;
    document.querySelectorAll("#dgPersone textarea").forEach((t) => { bozza.voci[t.dataset.i].nota = t.value.trim(); });
    const cambiate = bozza.voci.filter((v) => { const o = voce(v.data, v.persona); return (o.stato || null) !== (v.stato || null) || (o.nota || "") !== v.nota; });
    if (cambiate.length) { salva(cambiate); avviso("Salvato ✓"); }
    bozza = null;
  });

  /* ---------- settimane tipo: una sola o due alternate (A/B, es. 3+2) ---------- */
  const CICLO = ["", "smart", "ufficio", "l104"];
  const DAY = 864e5;
  const lunedi = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const settimane = (a, b) => Math.round((lunedi(b) - lunedi(a)) / (7 * DAY));
  // vecchio formato {max: {1: "smart"}} -> {max: {A: {...}, B: {}}}
  for (const [k, t] of Object.entries(pref.tipo)) if (t && !t.A) pref.tipo[k] = { A: t, B: {} };
  pref.alterna ??= false; pref.fino ??= "6";
  const modello = (p) => (pref.tipo[p] ||= { A: {}, B: {} });
  const fmtLun = (d) => `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}`;
  function rigaTipo(p, sett) {
    const t = modello(p)[sett];
    return `<div class="tipo-giorni">` + [1, 2, 3, 4, 5].map((g) => {
      const s = t[g] || "";
      return `<button type="button" data-p="${p}" data-s="${sett}" data-g="${g}" class="${s}">${GG[g]}<span>${s ? STATI[s].ic : "—"}</span></button>`;
    }).join("") + `</div>`;
  }
  const conteggio = (t) => Object.values(t).filter((s) => s === "smart").length;
  function disegnaTipo() {
    $("#tipoModo").querySelectorAll("button").forEach((b) => b.classList.toggle("attivo", (b.dataset.alterna === "1") === pref.alterna));
    $("#tipoPersone").innerHTML = PERSONE.map((p) => {
      const m = modello(p.id);
      return `<div class="persona-box"><div class="tipo-testa"><h4>${esc(p.nome)}</h4>` +
        (pref.alterna ? `<button type="button" class="secondario piccolo" data-preset="${p.id}">Modello 3+2</button>` : "") + `</div>` +
        (pref.alterna
          ? `<p class="etichetta">Settimana A · ${conteggio(m.A)} smart</p>${rigaTipo(p.id, "A")}<p class="etichetta">Settimana B · ${conteggio(m.B)} smart</p>${rigaTipo(p.id, "B")}`
          : rigaTipo(p.id, "A")) + `</div>`;
    }).join("");
    // da quale settimana parte la A: questa e le 8 successive (più quella già scelta, se è passata)
    const base = lunedi(oggi), scelte = [];
    for (let i = 0; i <= 8; i++) scelte.push(iso(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7 * i)));
    if (pref.inizio && !scelte.includes(pref.inizio)) scelte.unshift(pref.inizio);
    if (!pref.inizio) pref.inizio = scelte[0];
    $("#tipoInizio").innerHTML = scelte.map((s) => `<option value="${s}" ${s === pref.inizio ? "selected" : ""}>${pref.alterna ? "Settimana A dal" : "Dal"} lunedì ${fmtLun(daIso(s))}</option>`).join("");
    $("#tipoFino").value = pref.fino;
  }
  $("#btnTipo").addEventListener("click", () => { disegnaTipo(); $("#dlgTipo").showModal(); });
  $("#tipoModo").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; pref.alterna = b.dataset.alterna === "1"; salvaPref(); disegnaTipo(); });
  $("#tipoInizio").addEventListener("change", (e) => { pref.inizio = e.target.value; salvaPref(); });
  $("#tipoFino").addEventListener("change", (e) => { pref.fino = e.target.value; salvaPref(); });
  $("#tipoPersone").addEventListener("click", (e) => {
    const pr = e.target.closest("button[data-preset]");
    if (pr) { // A: lun-mer-ven smart, B: mar-gio smart; il resto in presenza
      const S = "smart", P = "ufficio";
      pref.tipo[pr.dataset.preset] = { A: { 1: S, 2: P, 3: S, 4: P, 5: S }, B: { 1: P, 2: S, 3: P, 4: S, 5: P } };
      salvaPref(); return disegnaTipo();
    }
    const b = e.target.closest("button[data-g]"); if (!b) return;
    const t = modello(b.dataset.p)[b.dataset.s];
    t[b.dataset.g] = CICLO[(CICLO.indexOf(t[b.dataset.g] || "") + 1) % CICLO.length];
    salvaPref(); disegnaTipo();
  });
  function fineIntervallo(da) {
    if (pref.fino === "anno") return new Date(da.getFullYear(), 11, 31);
    return new Date(da.getFullYear(), da.getMonth() + Number(pref.fino), da.getDate() - 1);
  }
  $("#dlgTipo").addEventListener("close", () => {
    if ($("#dlgTipo").returnValue !== "applica") return;
    const sostituisci = $("#tipoSostituisci").checked;
    const ancora = daIso(pref.inizio), da = new Date(Math.max(ancora, lunedi(oggi))), al = fineIntervallo(da);
    const righe = [];
    for (let d = new Date(da); d <= al; d.setDate(d.getDate() + 1)) {
      const data = iso(d), g = d.getDay();
      if (g === 0 || g === 6 || festa(data)) continue;
      const sett = pref.alterna && settimane(ancora, d) % 2 === 1 ? "B" : "A";
      for (const p of PERSONE) {
        const s = modello(p.id)[sett][g], v = voce(data, p.id);
        // ferie e L. 104 già segnate non si toccano mai; le note restano sempre
        const libero = !v.stato || (sostituisci && (v.stato === "smart" || v.stato === "ufficio"));
        if (s && libero && v.stato !== s) righe.push({ ...v, stato: s });
      }
    }
    if (!righe.length) return avviso("Niente da segnare: imposta i giorni o il periodo è già pieno");
    salva(righe); avviso(`Segnati ${righe.length} giorni fino al ${al.getDate()} ${MESI[al.getMonth()]} ✓`);
  });

  /* ---------- WhatsApp ---------- */
  function testoPiano(dal, al, titolo) {
    const righe = [`🗓️ *Smart Home · ${titolo}*`, `🏠 smart · 🏢 presenza · ❤️ L.104 · 🌴 ferie`, ""];
    const conta = Object.fromEntries(PERSONE.map((p) => [p.id, 0]));
    for (let d = new Date(dal); d <= al; d.setDate(d.getDate() + 1)) {
      const data = iso(d), fe = festa(data), we = d.getDay() === 0 || d.getDay() === 6;
      const voci = PERSONE.map((p) => voce(data, p.id));
      const qualcosa = voci.some((v) => v.stato || v.nota);
      if (we && !qualcosa) continue;
      const stati = voci.map((v, i) => { if (v.stato === "smart") conta[v.persona]++; return `${PERSONE[i].nome} ${v.stato ? STATI[v.stato].ic : "–"}`; }).join("   ");
      righe.push(`*${GG[d.getDay()]} ${d.getDate()}*  ${fe && !qualcosa ? "🎉 " + fe : stati}${fe && qualcosa ? "  🎉" : ""}`);
      voci.forEach((v, i) => { if (v.nota) righe.push(`    📝 ${PERSONE[i].nome}: ${v.nota.replace(/\n+/g, " · ")}`); });
    }
    righe.push("", "Totale smart: " + PERSONE.map((p) => `${p.nome} ${conta[p.id]}`).join(" · "));
    return righe.join("\n");
  }
  $("#btnWa").addEventListener("click", () => $("#dlgWa").showModal());
  $("#dlgWa").addEventListener("close", () => {
    const v = $("#dlgWa").returnValue; let dal, al, titolo;
    if (v === "mese") {
      dal = new Date(anno, mese, 1); al = new Date(anno, mese + 1, 0); titolo = `${MESI[mese]} ${anno}`;
    } else if (v === "settimana" || v === "prossima") {
      dal = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7) + (v === "prossima" ? 7 : 0));
      al = new Date(dal); al.setDate(dal.getDate() + 6);
      titolo = `settimana ${dal.getDate()} ${MESI[dal.getMonth()].slice(0, 3)} – ${al.getDate()} ${MESI[al.getMonth()].slice(0, 3)}`;
    } else return;
    window.open("https://wa.me/?text=" + encodeURIComponent(testoPiano(dal, al, titolo)), "_blank");
  });

  /* ---------- navigazione ---------- */
  const vaiA = (delta) => { mese += delta; if (mese < 0) { mese = 11; anno--; } if (mese > 11) { mese = 0; anno++; } disegna(); };
  $("#prec").addEventListener("click", () => vaiA(-1));
  $("#succ").addEventListener("click", () => vaiA(1));
  $("#oggi").addEventListener("click", () => { anno = oggi.getFullYear(); mese = oggi.getMonth(); disegna(); });
  // scorrimento laterale sul calendario per cambiare mese
  let x0 = null;
  griglia.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  griglia.addEventListener("touchend", (e) => {
    if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 70) { clearTimeout(timer); lungo = true; vaiA(dx < 0 ? 1 : -1); }
  });

  let tAvviso;
  function avviso(msg) { const el = $("#avviso"); el.textContent = msg; el.classList.add("vedi"); clearTimeout(tAvviso); tAvviso = setTimeout(() => el.classList.remove("vedi"), 2200); }

  disegna();
  carica();
  ascolta();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
