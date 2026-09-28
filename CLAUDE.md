# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Solicitudes de Insumos" (originally pharmacy-only): health centers request supplies by *rubro* (area: pharmacy, cleaning, laboratory, stationery); a single global admin delivers, closes and audits. Next.js 15 App Router + React 19 + Supabase (Postgres, Auth, RLS). UI text, code comments, docs and commit messages are in Spanish (rioplatense: "Revisá", "Intentá") — keep it that way.

## Git

- Never commit without the user's explicit permission.
- Never add AI attribution to commits or PRs (no `Co-Authored-By: Claude`, no "Generated with Claude Code").

## Commands

```powershell
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm test             # vitest run (tests/*.test.ts, no config file)
npx vitest run tests/requests.test.ts        # single file
npx vitest run -t "número de remito"         # single test by name
npm run build
```

Environment: copy `.env.example` to `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SECRET_KEY`).

## Database / migrations

- `supabase/migrations/*.sql` are **applied by hand** in the remote dev project's SQL Editor, in filename order. Nothing runs them automatically. Do not run anything against a remote Supabase project without explicit authorization. README.md lists the order and what each one adds.
- Seeds: `supabase/seed.sql` (fictional), `supabase/seed/productos.sql` (real pharmacy catalog), `supabase/seed/rubros.sql` (other areas, idempotent).
- When an RPC is rewritten, keep its signature compatible with existing callers (e.g. `create_request_with_items` used by `src/app/request-actions.ts`).

## Architecture

**Authorization is enforced twice**: in the app via guards, and in the database via RLS + `security definer` RPCs. The database is the authority; app checks mirror it.
- `src/lib/session.ts`: `getSession()` (React `cache`d per request; profile + center + areas in one embedded query), `requireSession()`, `requireRole('admin')`, `requireArea(area)`. Call the guard in **every page and server action**, not just the layout (layouts don't re-render on navigation). DB equivalents: `current_app_role()`, `current_health_center_id()`, `has_area()`.
- Roles (`app_role`): `admin` (single global admin, no center, sees all areas) and `requester` (tied to one health center, has areas in `profile_areas`). Areas are data (`public.areas`), not a hardcoded list; product types are per-area (`public.product_types`, composite FK `(area, product_type)`).
- `src/middleware.ts` only refreshes the Supabase session cookie and redirects unauthenticated users to `/login`.
- Supabase clients: `src/lib/supabase/server.ts` (session client, used for all app data) and `src/lib/supabase/admin.ts` (secret key, bypasses RLS — only for the Supabase Auth admin API inside actions already guarded by `requireRole('admin')`).

**Routing** (`src/app`): `(app)/` is the authenticated shell; `(app)/(admin)/` holds admin-only sections (`catalogos`, `usuarios`, `entregas`, `auditoria`). Server actions live in top-level files `src/app/*-actions.ts` (`request-`, `request-management-`, `product-`, `user-`, `profile-`).

**Writes**: multi-row/business operations go through Postgres RPCs (`create_request_with_items`, `register_delivery`, `close_request_items`, `void_delivery`, ...) that lock rows (`for update`), validate balances and write `audit_events` in the same transaction. Nothing is deleted: deliveries are voided, pending quantities are closed with a reason.

**Request status is computed, never stored/edited**: generated columns derive `delivered_quantity`, `pending_quantity` (requested − active deliveries − closed), `item_status` and `request_status` (Pendiente / Entrega parcial / Completada / Cerrada). Labels/colors in `src/lib/request-status.ts`.

**Feedback via URL codes**: actions redirect with `?error=<code>` / `?success=<code>` built by `withFeedback()`; `src/lib/feedback.ts` maps ASCII codes to Spanish messages. Never put free text or backend error messages in the URL. RPCs raise short code strings that `managementErrorCode()` (`src/lib/request-management.ts`) translates to feedback codes; add new codes in both places.

**Filters and search** are always resolved server-side with state in the URL: `useUrlFilters` / `useSearchFilter` (`src/hooks/use-url-filters.ts`) on the client; `searchTokens`, `likeContains`, `keySchema`, page-size/range helpers (`src/lib/filters.ts`) on the server, querying normalized `*_search_text` columns (`unaccent`, mirrored by `normalizeSearch`). See `docs/ui-reference/UI-SPEC.md` §11.1.

**Validation**: Zod on both client (React Hook Form + `@hookform/resolvers`) and server actions; server actions and RLS are authoritative. Length limits in TS constants must match DB checks.

## UI conventions

- Colors only through semantic tokens in `src/app/globals.css`; no raw Tailwind palette colors in pages.
- shadcn/ui-style primitives in `src/components/ui`; shared app components in `src/components`; feature components under `src/components/<feature>/`. Reuse before creating (see `docs/ui-reference/DESIGN-SYSTEM.md` §27–28).
- Specs: `docs/ui-reference/UI-SPEC.md` (screens/behavior), `DESIGN-SYSTEM.md` (tokens, components), screenshots in `docs/ui-reference/`.

## Plans

Work is organized in phased plans under `docs/plans/` (e.g. `plan-rubros.md`, `plan-gestion-solicitudes.md`) with checkboxes and recorded decisions. When completing a plan item, mark it `[x]` and note the decision taken.
