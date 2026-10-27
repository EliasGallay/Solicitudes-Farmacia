# Solicitudes de Farmacia — etapa 1

Base técnica en evolución. El login y la creación inicial de solicitudes están implementados; las entregas, cierres, administración y auditoría completa siguen pendientes. No contiene datos reales.

## Requisitos
- Node.js 22 LTS y npm.
- Una cuenta Supabase para una etapa posterior. No hace falta para abrir la pantalla inicial.

## Windows / PowerShell
```powershell
cd solicitudes-farmacia
npm install
npm run dev
```
Abrir http://localhost:3000. La pantalla inicial no necesita variables de Supabase.

Para comprobar el proyecto:
```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

## Convenciones de interfaz

- Los colores se definen como tokens semánticos en `src/app/globals.css`; las páginas no deben usar colores directos de Tailwind.
- Los formularios usan React Hook Form, Zod y componentes reutilizables en `src/components/ui`.
- Las Server Actions y RLS siguen siendo la autoridad para validar y autorizar operaciones; la validación del cliente solo mejora la experiencia.
- Los filtros y búsquedas se resuelven siempre en el servidor/base de datos y su estado vive en la URL: usar `useUrlFilters`/`useSearchFilter` (`src/hooks/use-url-filters.ts`) y `searchTokens`/`likeContains` (`src/lib/filters.ts`) sobre columnas de búsqueda normalizadas. Ver UI-SPEC §11.1.

## Supabase Cloud — NO ejecutar sin autorización
1. Crear un proyecto **exclusivo de desarrollo** cuando se autorice. No usar uno de producción.
2. Copiar `.env.example` a `.env.local` y completar la URL y la clave pública (`publishable`). No colocar `service_role` en variables `NEXT_PUBLIC_*`.
3. Revisar `supabase/migrations/202609180001_initial_schema.sql` y ejecutarla solo después de aprobarla. No se ejecuta automáticamente con `npm run dev`.
4. Ejecutar `supabase/seed.sql` únicamente en el proyecto de desarrollo vacío. Contiene 3 centros y 5 productos ficticios.
5. Aplicar también `supabase/migrations/202609210001_access_policies.sql` después de revisar el proyecto remoto de desarrollo. Esta migración agrega políticas RLS iniciales y una función RPC para crear solicitudes.
6. Aplicar `supabase/migrations/202609240001_request_item_quantities.sql`. Agrega las columnas computadas `delivered_quantity` y `pending_quantity` en `request_items`, que usan Inicio y el detalle de solicitud para calcular y filtrar cantidades. Sin esta migración esas pantallas muestran un error de carga.
7. Aplicar `supabase/migrations/202609240002_request_status.sql` (requiere la anterior). Agrega el estado calculado `request_status` en `requests` e `item_status` en `request_items`, usados en Inicio, Solicitudes y el detalle.
8. Aplicar `supabase/migrations/202609240003_request_number.sql`. Agrega el número de solicitud (`request_number`, secuencia global); numera las existentes por fecha de creación.
9. Aplicar `supabase/migrations/202609240004_request_observations.sql`. Agrega `requests.observations` y reemplaza la RPC `create_request_with_items` para aceptar la observación (parámetro opcional; las llamadas existentes siguen funcionando).
10. Aplicar `supabase/migrations/202609240005_product_type.sql`. Agrega el tipo de producto (Medicamento, Descartable, Equipamiento); los existentes quedan como Descartable y se corrigen desde `/catalogos`.
11. Aplicar `supabase/migrations/202609240006_search.sql`. Habilita `unaccent` y agrega las columnas de búsqueda normalizada (`product_search_text`, `item_search_text`, `request_search_text`, `request_number_text`) que usan todos los buscadores.
12. Ejecutar `supabase/seed/productos.sql` para cargar el catálogo real (72 productos por unidad, fuente `farmacia-base1.xlsx`; correcciones documentadas en `supabase/seed/productos-borrador.csv`). Desactiva los productos ficticios del seed inicial.
13. Aplicar `supabase/migrations/202609280001_areas.sql`. Agrega los rubros (`areas`, `profile_areas`, tipos de producto por rubro); todo lo existente queda en Farmacia. Sin cambios visibles.
14. Aplicar `supabase/migrations/202609280002_area_policies.sql`. Políticas de acceso por rubro: el admin ve todos; el solicitante, solo los suyos y su centro.
15. Aplicar `supabase/migrations/202609300001_user_admin.sql`. Gestión de usuarios desde `/usuarios` (perfil, rol, centro, rubros, email y último ingreso).
16. Aplicar `supabase/migrations/202610010001_own_profile.sql`. El propio usuario edita su nombre desde `/perfil`.
17. Aplicar `supabase/migrations/202610020001_request_management.sql`. Entregas con número de remito, cierres con motivo, anulación de entregas, cancelación por el solicitante y auditoría (RPCs `register_delivery`, `close_request_items`, `void_delivery`, `cancel_request`).
18. Aplicar `supabase/migrations/202610030001_request_actor_names.sql`. RPC `request_actor_names`: nombres de quienes actuaron sobre la solicitud, para el historial.
19. Aplicar `supabase/migrations/202610040001_delivery_receipts.sql`. Confirmación de recepción por el centro ítem por ítem, diferencias y su resolución por el admin; estado «Recibida».
20. Aplicar `supabase/migrations/202610080001_notifications.sql`. Notificaciones dentro de la app, generadas desde la auditoría.
21. Aplicar `supabase/migrations/202610190001_wrong_product_receipts.sql`. Opción «Producto equivocado» al confirmar la recepción.
22. Aplicar `supabase/migrations/202610190002_keepalive.sql`. Actividad diaria para que el proyecto gratuito no se pause (la llama `/api/cron/keepalive`, protegida con `CRON_SECRET`). Aplicarla en cada proyecto que se quiera mantener activo.
23. Aplicar `supabase/migrations/202610200001_admin_metrics.sql`. RPC de métricas del panel del administrador.
24. Aplicar `supabase/migrations/202610210001_purchase_requirements.sql`. Número de requerimiento de compra y estado «En compras».
25. Aplicar `supabase/migrations/202610210002_purchase_requirement_actor.sql`. Nombre de quien registró el requerimiento en el historial.
26. Aplicar `supabase/migrations/202610210003_void_closures.sql`. Anulación de cierres hechos por error (vuelven a pendiente).
27. Aplicar `supabase/migrations/202610210004_over_delivery.sql`. Permite entregar más de lo pendiente; el pendiente nunca queda negativo.
28. Aplicar `supabase/migrations/202610220001_fuzzy_search.sql`. Búsquedas tolerantes a errores de tipeo (`fuzzystrmatch`, RPC `search_variants`).
29. Aplicar `supabase/migrations/202610230001_request_edits.sql`. Corrección de solicitudes por el admin (cantidades y productos agregados, con motivo e historial).
30. Aplicar `supabase/migrations/202610230002_signed_delivery_notes.sql`. Confirmación de recepción por el admin con la foto o el PDF del remito firmado: bucket privado de Storage `remitos-firmados` (JPG, PNG, WebP o PDF, hasta 5 MB), tabla `delivery_signed_notes` y RPC `confirm_receipt_with_signed_note`. Sin esta migración el detalle de solicitudes y entregas muestra un error de carga.
31. Aplicar `supabase/migrations/202610270001_health_center_admin.sql`. Alta, renombrado y desactivación de centros por el admin (sección Centros); nombres únicos sin distinguir mayúsculas, hasta 80 caracteres.
32. Ejecutar `supabase/seed/rubros.sql` (con las migraciones ya aplicadas) para cargar Librería, Laboratorio y Limpieza. Es idempotente.

## Puesta en marcha remota de la etapa 2

En el SQL Editor del proyecto remoto de desarrollo, ejecutar una sola vez:

1. `supabase/migrations/202609210001_access_policies.sql`
2. Crear un usuario desde **Authentication > Users**.
3. Asociar ese usuario con un perfil. Para un administrador:

```sql
insert into public.profiles (user_id, full_name, role, health_center_id, must_change_password)
select id, 'Administrador inicial', 'admin', null, true
from auth.users
where email = 'admin@ejemplo.com';
```

Para un farmacéutico, usar el identificador del centro existente:

```sql
insert into public.profiles (user_id, full_name, role, health_center_id, must_change_password)
select u.id, 'Farmacéutico de prueba', 'pharmacist', h.id, true
from auth.users u
cross join public.health_centers h
where u.email = 'farmacia@ejemplo.com' and h.name = 'Houssay';
```

La contraseña inicial se define en Supabase Auth y no se guarda en este repositorio. El primer acceso redirige al cambio obligatorio de contraseña.

Verificación mínima posterior:

```sql
select full_name, role, health_center_id, must_change_password from public.profiles;
select name, presentation, active from public.products order by name;
```

## Administrador inicial — procedimiento pendiente de etapa 2
La cuenta inicial deberá crearse manualmente en Supabase Auth y asociarse mediante un registro `profiles` con `role='admin'`, `health_center_id=null` y `must_change_password=true`. No se incluye SQL con contraseñas ni se crea una cuenta automáticamente. Validar previamente el flujo de cambio de contraseña y permisos.

## Decisiones y límites
- No se importa `FAMRACIA-BASE.xlsx` ni se utilizan cantidades históricas.
- No se crean recursos externos ni se aplican migraciones remotas.
- El esquema es una base inicial, **no la implementación completa de integridad transaccional**: las invariantes agregadas entre varias entregas, el bloqueo concurrente, las políticas RLS, las funciones de negocio y la auditoría inmutable requieren funciones/roles/controles adicionales antes de permitir escrituras.
- La integración SSR incluye un cliente de servidor, pero la renovación de cookies en middleware y las rutas de autenticación pertenecen a la etapa 2.
- No hay credenciales reales, usuarios creados ni conexión activa.
#   S o l i c i t u d e s - F a r m a c i a  
 
