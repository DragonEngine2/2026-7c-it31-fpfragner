# Fullstack-App – React (BRG Kepler Graz, 7. Klasse)

Ein Repository für das Modul **IT-31 Fullstack-App**, umgeschrieben auf **React**.

## Schnellstart

```bash
npm install
npm run dev
```

* Die App und die API laufen unter <http://localhost:3000> (Vite + Hono API Middleware).

## Aufbau

* `src/client/` – Oberfläche (React 19 + Tailwind CSS). `api.ts` ist die Schnittstelle für Datenzugriff.
* `src/server/` – API (Hono). `store.ts` ist die Daten-Schnittstelle, `db/schema.ts` das Datenbankschema.
* `src/shared/schemas.ts` – Zod-Schemas und TypeScript-Typen für Frontend und Backend.
* `data/seed.json` – Demodaten.
* `drizzle/` – SQL-Migrationen.
* `snippets/` – Referenzlösungen zu den Aufgaben.
* `AGENTS.md` – Regeln für KI-Agenten.

## Videos

Das Formular unterstützt YouTube-Links, direkte Video-URLs und MP4-Uploads. Die API nimmt Uploads als `multipart/form-data` im Feld `file` unter `POST /api/upload` entgegen. Unterstützt werden MP4, WebM, MOV und OGG; gespeicherte Dateien liegen in `uploads/` und sind über `/api/uploads/<filename>` erreichbar. Der Upload-Ordner wird nicht von Git erfasst.

Katalogeinträge und Nutzerkonten werden mit Drizzle in `data/app.db` gespeichert und bleiben nach einem Serverneustart erhalten. Migrationen aus `drizzle/` werden beim Start automatisch angewendet. `data/app.db` wird nicht von Git erfasst. Für die Nutzung ist eine Registrierung oder Anmeldung erforderlich; die Passwörter werden gehasht gespeichert und die Sitzung über ein HttpOnly-Cookie verwaltet.

## Befehle

* `npm run dev` – Entwicklungsserver auf Port 3000
* `npm test` – Vitest-Tests ausführen
* `npm run typecheck` – TypeScript prüfen
* `npm run build` – Produktiver Build (dist/client)
* `npm run build:static` – Statischer Build ohne Backend (localStorage)
