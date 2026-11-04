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

## Befehle

* `npm run dev` – Entwicklungsserver auf Port 3000
* `npm test` – Vitest-Tests ausführen
* `npm run typecheck` – TypeScript prüfen
* `npm run build` – Produktiver Build (dist/client)
* `npm run build:static` – Statischer Build ohne Backend (localStorage)
