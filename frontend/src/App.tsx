import React, { useEffect, useMemo, useState } from "react";
import { LogOut, Server, Printer, User, CircleDot, LayoutGrid } from "lucide-react";
import { Badge, StatusDot, PillTab, Section, Card } from "./lib/ui";
import UsersSettings from "./settings/Users";

type TabKey = "SCONTRINO" | "MENU1" | "MENU2" | "IMPOSTAZIONI";

export default function App(){
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<{ id:number; username:string; nome?:string; cognome?:string; ruolo?:string; emittente_id?:number }|null>(null);
  const [now, setNow] = useState(new Date());
  const [serverOk, setServerOk] = useState<boolean|undefined>(undefined);
  const [printerOk, setPrinterOk] = useState<boolean|undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabKey|null>(null);
  const [settingsView, setSettingsView] = useState<"GRID"|"UTENTI">("GRID");

  useEffect(()=>{ const t = setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);
  const timeLabel = useMemo(()=> now.toLocaleTimeString([], {hour12:false}), [now]);

  async function pingServer(){
    try{ const r = await fetch("/health", {cache:"no-store"}); setServerOk(r.ok); }catch{ setServerOk(false); }
  }
  async function checkPrinter(){
    if(!currentUser){ setPrinterOk(undefined); return; }
    try{
      const q = new URLSearchParams({ emittente_id: String(currentUser.emittente_id||"") });
      const r = await fetch(`/printer/status?${q.toString()}`, {cache:"no-store"});
      if(!r.ok) throw new Error("http "+r.status);
      const j = await r.json(); setPrinterOk(!!j.online);
    }catch{ setPrinterOk(false); }
  }
  useEffect(()=>{ if(isAuthenticated){ pingServer(); checkPrinter(); const i1=setInterval(pingServer,10000); const i2=setInterval(checkPrinter,15000); return ()=>{clearInterval(i1); clearInterval(i2);} } },[isAuthenticated, currentUser]);

  async function handleLogin(e: React.FormEvent){
    e.preventDefault(); if(!username.trim()||!password.trim()) return;
    const res = await fetch("/auth/login", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ username: username.trim(), password }) });
    if(!res.ok){ alert("Credenziali non valide"); return; }
    const data = await res.json();
    setCurrentUser(data); setAuthenticated(true); setUsername(""); setPassword(""); setActiveTab(null); setSettingsView("GRID");
  }
  function handleLogout(){ setAuthenticated(false); setCurrentUser(null); setActiveTab(null); setServerOk(undefined); setPrinterOk(undefined); setSettingsView("GRID"); }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-5 w-5" />
              <div className="font-semibold">Stampa Scontrini</div>
              <Badge title="ora corrente"><CircleDot className="h-3 w-3"/> {timeLabel}</Badge>
              <Badge title="stato server"><Server className="h-3 w-3"/><StatusDot ok={serverOk}/><span>{serverOk===undefined?"verifica…":serverOk?"Server OK":"Server KO"}</span></Badge>
              <Badge title="stato stampante"><Printer className="h-3 w-3"/><StatusDot ok={printerOk}/><span>{printerOk===undefined?"verifica…":printerOk?"Stampante: Online":"Stampante: Offline"}</span></Badge>
            </div>
            <div className="flex items-center gap-3">
              <Badge><User className="h-3 w-3"/> {currentUser?((currentUser.nome||"")+" "+(currentUser.cognome||"")+" · "+(currentUser.ruolo||"utente")).trim():"non autenticato"}</Badge>
              <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50" disabled={!isAuthenticated}><LogOut className="h-4 w-4"/> Logout</button>
            </div>
          </div>
          <div className="pb-3 flex items-center gap-2">
            <PillTab active={activeTab==="SCONTRINO"} onClick={()=>setActiveTab("SCONTRINO")}>Scontrino</PillTab>
            <PillTab active={activeTab==="MENU1"} onClick={()=>setActiveTab("MENU1")}>Menu 1</PillTab>
            <PillTab active={activeTab==="MENU2"} onClick={()=>setActiveTab("MENU2")}>Menu 2</PillTab>
            <PillTab active={activeTab==="IMPOSTAZIONI"} onClick={()=>setActiveTab("IMPOSTAZIONI")}>Impostazioni</PillTab>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {!isAuthenticated && (
          <div className="relative">
            <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm rounded-2xl border border-zinc-800" />
            <div className="relative z-10 max-w-md mx-auto mt-10">
              <form onSubmit={handleLogin} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow">
                <h2 className="text-xl font-semibold mb-4">Accesso richiesto</h2>
                <label className="block text-sm text-zinc-300 mb-1">Utente</label>
                <input className="w-full mb-3 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-600" value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="username"/>
                <label className="block text-sm text-zinc-300 mb-1">Password</label>
                <input type="password" className="w-full mb-4 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-600" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••"/>
                <div className="flex justify-end"><button className="rounded-lg bg-zinc-100 text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-white">Entra</button></div>
              </form>
            </div>
          </div>
        )}

        {isAuthenticated && !activeTab && (<div className="text-zinc-400 text-sm italic">Seleziona una voce nel menu in alto per iniziare…</div>)}

        {isAuthenticated && activeTab === "IMPOSTAZIONI" && (
          settingsView === "GRID"
            ? <ImpostazioniGrid onOpenUsers={()=>{
                if(currentUser?.ruolo !== "admin"){ alert("Solo amministratori"); return; }
                setSettingsView("UTENTI");
              }}/>
            : (currentUser?.emittente_id
                ? <UsersSettings emittenteId={currentUser.emittente_id!} canEdit={currentUser?.ruolo === "admin"} onBack={()=>setSettingsView("GRID")} />
                : <div className="text-zinc-400">Nessuna emittente associata all'utente corrente.</div>
              )
        )}

        {isAuthenticated && activeTab === "SCONTRINO" && <Placeholder title="Scontrino"/>}
        {isAuthenticated && activeTab === "MENU1" && <Placeholder title="Menu 1"/>}
        {isAuthenticated && activeTab === "MENU2" && <Placeholder title="Menu 2"/>}
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950/80">
        <div className="max-w-7xl mx-auto px-4 h-10 flex items-center justify-between text-xs text-zinc-400">
          <div>rev02 · build vite</div>
          <div className="flex items-center gap-3"><Badge title="latency">Latenza backend ~10s poll</Badge></div>
        </div>
      </footer>
    </div>
  );
}

function Placeholder({ title }: { title: string }){
  return <Section title={title}><div className="text-zinc-400">Contenuto in preparazione…</div></Section>;
}

function ImpostazioniGrid({ onOpenUsers }:{ onOpenUsers:()=>void }){
  const items = [
    { title: "Home", subtitle: "Ritorna alla principale", onClick: ()=>{} },
    { title: "Clienti", subtitle: "Anagrafiche", onClick: ()=>{} },
    { title: "Scontrini", subtitle: "Storico", onClick: ()=>{} },
    { title: "Messaggi", subtitle: "Intestazioni/Piedi", onClick: ()=>{} },
    { title: "Pagamenti", subtitle: "Metodi", onClick: ()=>{} },
    { title: "Utenti", subtitle: "Accessi", onClick: onOpenUsers },
    { title: "Emittenti", subtitle: "Anagrafiche", onClick: ()=>{} },
    { title: "Articoli", subtitle: "Catalogo", onClick: ()=>{} },
    { title: "% IVA", subtitle: "Aliquote", onClick: ()=>{} },
    { title: "Allegati", subtitle: "File", onClick: ()=>{} },
    { title: "Comparti", subtitle: "Categorie", onClick: ()=>{} }
  ];
  return (
    <Section title="Impostazioni">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {items.map((it,i)=> (
          <Card key={i} onClick={it.onClick}>
            <div className="flex items-center gap-4">
              <StatusDot ok/>
              <div>
                <div className="font-medium text-zinc-100">{it.title}</div>
                <div className="text-sm text-zinc-400">{it.subtitle}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
