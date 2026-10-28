# Solicitudes de Insumos

Aplicación web para que los centros de salud de la Municipalidad de Funes pidan insumos a la Secretaría de Salud y para que la administración los entregue, haga el seguimiento y deje constancia de todo. Empezó como un sistema solo para farmacia y hoy cubre varios **rubros**: Farmacia, Limpieza, Laboratorio y Librería.

## Qué problema resuelve

Antes, los pedidos de los centros viajaban por mensajes, planillas y papel. Eso traía problemas:

- no se sabía qué se había pedido, qué se entregó y qué faltaba;
- las entregas parciales y los faltantes se perdían entre un pedido y otro;
- no había constancia de que el centro hubiera recibido lo enviado, ni de las diferencias (faltantes, productos dañados o equivocados);
- no quedaba registro de quién hizo cada cosa y cuándo.

La app ordena ese circuito en un solo lugar:

1. **El centro pide.** Un usuario del centro arma la solicitud con productos del catálogo de su rubro y agrega observaciones.
2. **La administración entrega.** Registra entregas totales o parciales, cada una con su número de remito imprimible. Si algo no se puede entregar, cierra el pendiente con un motivo (sin stock, discontinuado, etc.). Si hay que comprarlo, anota el número de requerimiento de compra.
3. **El centro confirma la recepción.** Confirma producto por producto: recibido conforme, con diferencia o producto equivocado. Si el centro no la confirma en el sistema, el admin puede hacerlo con la foto del remito firmado.
4. **La administración resuelve las diferencias.** El faltante vuelve a pendiente para reenviarlo, o se cierra.
5. **Todo queda registrado.** Historial por solicitud, auditoría global y notificaciones a los involucrados.

### Estados de una solicitud

El estado lo calcula la base de datos con las cantidades; nadie lo edita a mano.

| Estado | Significa |
|---|---|
| Pendiente | Hay productos sin entregar y todavía no hubo entregas. |
| En compras | Tiene requerimiento de compra registrado y queda pendiente. |
| Entrega parcial | Se entregó una parte y queda pendiente. |
| Entregada | Se entregó todo, pero falta que se confirme la recepción. |
| Recibida | Entregada y confirmada, sin diferencias abiertas. |
| Cerrada | Lo que faltaba se cerró (o el centro canceló la solicitud). |

## Roles

- **Administrador** (uno global, sin centro): ve todos los centros y rubros. Entrega, cierra, corrige solicitudes, registra requerimientos de compra, resuelve diferencias, confirma recepciones con el remito firmado y administra catálogos y usuarios. También ve la auditoría y un panel con métricas.
- **Solicitante** (pertenece a un centro y tiene uno o más rubros): crea solicitudes de sus rubros, sigue su estado, confirma lo que recibió, imprime la constancia de recepción y puede cancelar mientras no haya entregas.

## Funcionalidades

- **Solicitudes:** asistente de nueva solicitud con catálogo por rubro; listado y detalle con filtros, búsqueda y paginación; hoja de pedido imprimible; cancelación por el centro.
- **Gestión del admin:** bandeja «Por atender» ordenada por antigüedad, con días de espera.
  - Entregas parciales o totales, incluso por encima de lo pedido.
  - Cierre del pendiente con motivo; anulación de entregas y de cierres hechos por error.
  - Corrección de cantidades y productos con motivo.
  - Requerimiento de compra.
- **Entregas y remitos:** sección Entregas con búsqueda por número de remito o de solicitud. Remito imprimible y constancia de recepción imprimible.
- **Recepción:** confirmación por línea (conforme, con diferencia, producto equivocado) y resolución de diferencias por el admin. Confirmación por el admin adjuntando el remito firmado (foto JPG/PNG/WebP o PDF, hasta 5 MB; las fotos se achican en el navegador).
- **Catálogos:** productos y tipos de producto por rubro, con activación y desactivación.
- **Usuarios:** alta, edición, rubros, contraseña temporal, desactivación y baja. La contraseña se cambia obligatoriamente al primer ingreso; también hay recuperación por email.
- **Notificaciones** en la app (campana y sección propia) generadas por cada operación.
- **Auditoría** con filtros por acción, usuario y fecha.
- **Búsquedas tolerantes:** ignoran acentos, mayúsculas y errores de tipeo («diasepam» encuentra «Diazepam»).
- **Recorridos guiados** por pantalla para el solicitante, modo claro y oscuro, diseño adaptable a celular.

## Cómo está construida

### Tecnologías

- **Next.js** (App Router, Server Components y Server Actions), **React 19** y **TypeScript**.
- **Supabase**: Postgres, Auth y Storage. Las reglas de negocio viven en la base: RLS y funciones RPC.
- **Tailwind CSS 4** con tokens semánticos y componentes estilo shadcn/ui (Radix).
- **React Hook Form + Zod** para formularios y validación; **Vitest** para tests.
- Despliegue en **Vercel**, con un Vercel Cron diario (`vercel.json`) que mantiene activo el proyecto de Supabase.

### Decisiones de arquitectura

- **La autorización se controla dos veces.** En la app, cada página y server action llama a su guard (`requireSession`, `requireRole('admin')`, `requireArea`, en `src/lib/session.ts`). En la base, con RLS y funciones `security definer` (`current_app_role()`, `current_health_center_id()`, `has_area()`). La base es la autoridad; la app solo responde antes y mejor.
- **Las escrituras de negocio son RPCs transaccionales.** Ejemplos: `create_request_with_items`, `register_delivery`, `close_request_items`, `void_delivery`, `confirm_receipt`, `confirm_receipt_with_signed_note`. Cada una bloquea la solicitud (`for update`), revalida saldos y permisos y escribe el evento de auditoría en la misma transacción. Dos operaciones sobre la misma solicitud no pueden pisarse.
- **Nada se borra.** Las entregas y los cierres se anulan; el pendiente se cierra con motivo; los remitos firmados quedan adjuntos. El historial siempre se puede reconstruir.
- **Cantidades y estados calculados.** Las columnas generadas derivan lo entregado, lo pendiente y el estado de cada producto y de la solicitud. No hay un campo de estado editable que pueda quedar desactualizado.
- **Notificaciones desde la auditoría.** Un trigger sobre `audit_events` genera las notificaciones, así nacen en la misma transacción que la operación.
- **Mensajes por código.** Las acciones redirigen con `?error=<código>` / `?success=<código>`, y `src/lib/feedback.ts` los traduce al español. En la URL nunca viaja texto libre ni errores técnicos del backend.
- **Filtros y búsqueda en el servidor,** con el estado en la URL (`src/hooks/use-url-filters.ts`, `src/lib/filters.ts`). Se busca sobre columnas normalizadas con `unaccent` y variantes parecidas (`search_variants`).
- **Dos clientes de Supabase.** `src/lib/supabase/server.ts` usa la sesión del usuario y sirve para todos los datos. `src/lib/supabase/admin.ts` usa la clave secreta y se limita a la API de Auth en acciones de admin y a la tarea programada.

### Estructura del código

```
src/
  app/
    (app)/                 shell autenticado (sidebar): inicio, solicitudes, catálogo, perfil, notificaciones
    (app)/(admin)/         solo admin: catalogos, usuarios, entregas, auditoria
    remitos/, recepciones/, hojas-de-pedido/   documentos imprimibles, fuera del shell
    api/                   rutas de notificaciones y cron (/api/cron/keepalive)
    *-actions.ts           server actions (request-, request-management-, product-, user-, profile-, notification-)
  components/              componentes compartidos; ui/ (primitivas) y una carpeta por funcionalidad
  lib/                     sesión, consultas, estados, filtros, mensajes, utilidades
  middleware.ts            refresca la sesión y redirige a /login
supabase/
  migrations/              esquema, RLS y RPCs (se aplican a mano, en orden)
  seed.sql, seed/          datos ficticios, catálogo real de farmacia y rubros
docs/
  ui-reference/            UI-SPEC.md (pantallas y comportamiento), DESIGN-SYSTEM.md, capturas
  plans/                   planes por fase, con decisiones registradas
tests/                     tests de Vitest
```

## Puesta en marcha local

Requisitos: Node.js 22 LTS y npm, y un proyecto de Supabase **de desarrollo**.

```powershell
npm install
copy .env.example .env.local   # completar las variables
npm run dev                    # http://localhost:3000
```

Variables (`.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase > Project Settings > API Keys.
- `SUPABASE_SECRET_KEY`: clave secreta, solo del servidor (gestión de usuarios). Nunca con prefijo `NEXT_PUBLIC_`.
- `CRON_SECRET`: secreto de Vercel Cron para `/api/cron/keepalive`. Solo hace falta en Vercel.

Comprobaciones:

```powershell
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run build
```

## Base de datos (Supabase) — NO ejecutar sin autorización

Las migraciones **se aplican a mano** en el SQL Editor del proyecto de desarrollo, en este orden. Nada las ejecuta automáticamente y no se debe usar un proyecto de producción sin revisarlas antes.

1. Aplicar `supabase/migrations/202609180001_initial_schema.sql`. Esquema inicial (centros, perfiles, productos, solicitudes, entregas).
2. Ejecutar `supabase/seed.sql` únicamente en el proyecto vacío. Contiene 3 centros (Houssay, Maradona, Faust) y 5 productos ficticios.
3. Aplicar `supabase/migrations/202609210001_access_policies.sql`. Políticas RLS iniciales y la RPC para crear solicitudes.
4. Aplicar `supabase/migrations/202609240001_request_item_quantities.sql`. Columnas computadas `delivered_quantity` y `pending_quantity` en `request_items`.
5. Aplicar `supabase/migrations/202609240002_request_status.sql`. Estado calculado `request_status` en `requests` e `item_status` en `request_items`.
6. Aplicar `supabase/migrations/202609240003_request_number.sql`. Número de solicitud (`request_number`, secuencia global).
7. Aplicar `supabase/migrations/202609240004_request_observations.sql`. Observaciones de la solicitud (`create_request_with_items` acepta la observación como parámetro opcional).
8. Aplicar `supabase/migrations/202609240005_product_type.sql`. Tipo de producto; los existentes quedan como Descartable y se corrigen desde `/catalogos`.
9. Aplicar `supabase/migrations/202609240006_search.sql`. `unaccent` y columnas de búsqueda normalizada que usan todos los buscadores.
10. Ejecutar `supabase/seed/productos.sql`. Catálogo real de farmacia (72 productos por unidad; correcciones en `supabase/seed/productos-borrador.csv`). Desactiva los productos ficticios.
11. Aplicar `supabase/migrations/202609280001_areas.sql`. Rubros (`areas`, `profile_areas`, tipos de producto por rubro); todo lo existente queda en Farmacia y el rol `pharmacist` pasa a `requester`.
12. Aplicar `supabase/migrations/202609280002_area_policies.sql`. Acceso por rubro: el admin ve todos; el solicitante, solo los suyos y su centro.
13. Aplicar `supabase/migrations/202609300001_user_admin.sql`. Gestión de usuarios desde `/usuarios`.
14. Aplicar `supabase/migrations/202610010001_own_profile.sql`. El propio usuario edita su nombre desde `/perfil`.
15. Aplicar `supabase/migrations/202610020001_request_management.sql`. Entregas con número de remito, cierres con motivo, anulación, cancelación por el solicitante y auditoría.
16. Aplicar `supabase/migrations/202610030001_request_actor_names.sql`. Nombres de quienes actuaron sobre la solicitud, para el historial.
17. Aplicar `supabase/migrations/202610040001_delivery_receipts.sql`. Confirmación de recepción por el centro, diferencias y su resolución; estado «Recibida».
18. Aplicar `supabase/migrations/202610080001_notifications.sql`. Notificaciones dentro de la app, generadas desde la auditoría.
19. Aplicar `supabase/migrations/202610190001_wrong_product_receipts.sql`. Opción «Producto equivocado» al confirmar la recepción.
20. Aplicar `supabase/migrations/202610190002_keepalive.sql`. Actividad diaria para que el proyecto gratuito no se pause (la llama `/api/cron/keepalive`). Aplicarla en cada proyecto que se quiera mantener activo.
21. Aplicar `supabase/migrations/202610200001_admin_metrics.sql`. Métricas del panel del administrador.
22. Aplicar `supabase/migrations/202610210001_purchase_requirements.sql`. Requerimiento de compra y estado «En compras».
23. Aplicar `supabase/migrations/202610210002_purchase_requirement_actor.sql`. Nombre de quien registró el requerimiento en el historial.
24. Aplicar `supabase/migrations/202610210003_void_closures.sql`. Anulación de cierres hechos por error.
25. Aplicar `supabase/migrations/202610210004_over_delivery.sql`. Entregas por encima de lo pendiente; el pendiente nunca queda negativo.
26. Aplicar `supabase/migrations/202610220001_fuzzy_search.sql`. Búsquedas tolerantes a errores de tipeo (`fuzzystrmatch`, `search_variants`).
27. Aplicar `supabase/migrations/202610230001_request_edits.sql`. Corrección de solicitudes por el admin, con motivo e historial.
28. Aplicar `supabase/migrations/202610230002_signed_delivery_notes.sql`. Confirmación de recepción por el admin con el remito firmado: bucket privado `remitos-firmados` (JPG, PNG, WebP o PDF, hasta 5 MB), tabla `delivery_signed_notes` y RPC `confirm_receipt_with_signed_note`.
29. Aplicar `supabase/migrations/202610270001_health_center_admin.sql`. Alta, renombrado y desactivación de centros por el admin (sección Centros); nombres únicos sin distinguir mayúsculas, hasta 80 caracteres.
30. Ejecutar `supabase/seed/rubros.sql`. Carga Librería, Laboratorio y Limpieza con sus productos; es idempotente.

Si falta una migración, las pantallas que dependen de ella muestran un error de carga.

### Primer administrador

La cuenta inicial se crea a mano. Las demás se crean desde `/usuarios`.

1. Crear el usuario en Supabase > **Authentication > Users**. La contraseña no se guarda en el repositorio.
2. Asociarlo a un perfil de administrador:

```sql
insert into public.profiles (user_id, full_name, role, health_center_id, must_change_password)
select id, 'Administrador inicial', 'admin', null, true
from auth.users
where email = 'admin@ejemplo.com';
```

En el primer ingreso se pide cambiar la contraseña. Desde ahí, el admin crea los solicitantes, con su centro y sus rubros, en `/usuarios`.

## Convenciones

- Textos de la interfaz, comentarios, documentación y commits en español rioplatense.
- Colores solo con los tokens semánticos de `src/app/globals.css`; no se usan colores directos de Tailwind en las páginas.
- Antes de crear un componente, se revisa si ya existe (`docs/ui-reference/DESIGN-SYSTEM.md`).
- Validación con Zod en el cliente y en las server actions; los límites de longitud coinciden con los checks de la base.
- El trabajo se organiza en planes por fase (`docs/plans/`), donde se marcan los ítems hechos y se anota la decisión tomada.
