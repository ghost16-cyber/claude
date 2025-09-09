import React from "react";
export function Badge({ children, title }: {children: React.ReactNode; title?: string}) {
  return <span title={title} className="badge">{children}</span>;
}
export function StatusDot({ ok }: { ok?: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok===true?"bg-emerald-500":ok===false?"bg-red-500":"bg-zinc-500"}`} />;
}
export function PillTab({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`pill ${active?"pill-on":"pill-off"}`}>{children}</button>;
}
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border border-zinc-800 rounded-2xl bg-zinc-950/50 p-5"><h2 className="text-lg font-semibold text-zinc-200 mb-4">{title}</h2>{children}</section>;
}
export function Card({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <button onClick={onClick} className="card">{children}</button>;
}
