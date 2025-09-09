from datetime import datetime
import socket
# /opt/scontrini/src/backend/main.py
import os
import uuid
import json
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
import psycopg2.extras

DB_DSN = os.getenv(
    "SCONTRINI_DSN",
    "dbname=scontrini user=scontrini password=33trentinitrotterellavano host=127.0.0.1 port=5432"
)

app = FastAPI(title="Scontrini API", version="1.0")

# Se servi il frontend dallo stesso host/porta dietro nginx, puoi rimuovere il CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

def get_conn():
    return psycopg2.connect(DB_DSN)

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/auth/login")
def login(req: LoginRequest):
    with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        # Usiamo una funzione SQL che valida la password e ritorna i campi pubblici
        cur.execute("SELECT * FROM public.sc_login(%s, %s)", (req.username, req.password))
        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=401, detail="Credenziali non valide")

        # Facoltativo: potresti generare un token di sessione server-side.
        # Qui rispondiamo con i soli dati utente non sensibili.
        user = dict(row)
        user.pop("password_hash", None)
        user.pop("salt", None)
        return user
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/printer/status")
def printer_status(emittente_id: int):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT COALESCE(printer_host::text, ''), COALESCE(printer_port, 9100)
            FROM public.emittenti
            WHERE id = %s
        """, (emittente_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Emittente non trovata")
        host, port = row
        online = False
        if host:
            try:
                with socket.create_connection((host, int(port)), timeout=0.8):
                    online = True
            except Exception:
                online = False
        return {"host": host, "port": int(port), "online": online}

from pydantic import BaseModel, field_validator
from typing import Optional, List

class UserOut(BaseModel):
    id: int
    username: str
    nome: Optional[str] = None
    cognome: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    ruolo: Optional[str] = None
    emittente_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

class UserCreate(BaseModel):
    username: str
    password: str
    nome: Optional[str] = None
    cognome: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    ruolo: Optional[str] = "user"
    emittente_id: Optional[int] = None

    @field_validator("username")
    @classmethod
    def _check_username(cls, v):
        v = v.strip()
        if len(v) < 3: raise ValueError("username troppo corto")
        return v

    @field_validator("password")
    @classmethod
    def _check_password(cls, v):
        if len(v) < 4: raise ValueError("password troppo corta")
        return v

class UserUpdate(BaseModel):
    password: Optional[str] = None
    nome: Optional[str] = None
    cognome: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    ruolo: Optional[str] = None
    emittente_id: Optional[int] = None

@app.get("/users", response_model=List[UserOut])
def list_users(emittente_id: Optional[int] = None):
    sql = """
      SELECT id, username, nome, cognome, email, telefono, ruolo, emittente_id, created_at, updated_at
        FROM public.utenti
       WHERE (%s IS NULL OR emittente_id = %s)
       ORDER BY id
    """
    with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(sql, (emittente_id, emittente_id))
        rows = [dict(r) for r in cur.fetchall()]
        return rows

@app.post("/users", response_model=UserOut, status_code=201)
def create_user(u: UserCreate):
    with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        # username unico?
        cur.execute("SELECT 1 FROM public.utenti WHERE username = %s", (u.username,))
        if cur.fetchone():
            raise HTTPException(409, detail="Username già esistente")

        # calcola hash bcrypt lato DB
        cur.execute("SELECT crypt(%s, gen_salt('bf', 12))", (u.password,))
        pwd_hash = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO public.utenti
              (username, password_hash, salt, nome, cognome, email, telefono, ruolo, emittente_id)
            VALUES (%s,%s,'',%s,%s,%s,%s,%s,%s)
            RETURNING id, username, nome, cognome, email, telefono, ruolo, emittente_id, created_at, updated_at
        """, (u.username, pwd_hash, u.nome, u.cognome, u.email, u.telefono, u.ruolo, u.emittente_id))
        row = dict(cur.fetchone())
        return row

@app.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, u: UserUpdate):
    fields = []
    values = []
    if u.nome is not None:        fields.append("nome=%s");        values.append(u.nome)
    if u.cognome is not None:     fields.append("cognome=%s");     values.append(u.cognome)
    if u.email is not None:       fields.append("email=%s");       values.append(u.email)
    if u.telefono is not None:    fields.append("telefono=%s");    values.append(u.telefono)
    if u.ruolo is not None:       fields.append("ruolo=%s");       values.append(u.ruolo)
    if u.emittente_id is not None:fields.append("emittente_id=%s");values.append(u.emittente_id)

    with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        # password opzionale
        if u.password:
            cur.execute("SELECT crypt(%s, gen_salt('bf', 12))", (u.password,))
            pwd_hash = cur.fetchone()[0]
            fields.append("password_hash=%s"); values.append(pwd_hash)
            fields.append("salt=''")  # non usato con bcrypt

        if not fields:
            # niente da aggiornare → ritorna l'utente com'è
            cur.execute("""
              SELECT id, username, nome, cognome, email, telefono, ruolo, emittente_id, created_at, updated_at
                FROM public.utenti WHERE id=%s
            """, (user_id,))
            row = cur.fetchone()
            if not row: raise HTTPException(404, "Utente non trovato")
            return dict(row)

        sql = f"""
            UPDATE public.utenti
               SET {', '.join(fields)}, updated_at = now()
             WHERE id = %s
         RETURNING id, username, nome, cognome, email, telefono, ruolo, emittente_id, created_at, updated_at
        """
        values.append(user_id)
        cur.execute(sql, tuple(values))
        row = cur.fetchone()
        if not row: raise HTTPException(404, "Utente non trovato")
        return dict(row)

@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM public.utenti WHERE id=%s", (user_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Utente non trovato")
        return ""

