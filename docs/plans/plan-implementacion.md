# Plan de implementación — Solicitudes de Farmacia

## Objetivo

Convertir la base técnica actual en una aplicación operativa para gestionar solicitudes y entregas de farmacia usando exclusivamente el proyecto remoto de Supabase.

## Alcance y restricciones

- Supabase remoto como única base de datos; no se incorpora Docker ni una instancia local.
- El proyecto remoto debe ser exclusivamente de desarrollo hasta completar las validaciones.
- No se cargan datos reales durante el desarrollo.
- Las migraciones y los cambios de base quedan versionados en `supabase/migrations/`.
- `supabase/seed.sql` se utiliza únicamente para datos ficticios de desarrollo.

## Estado inicial

- Next.js, React, TypeScript, Tailwind y Supabase SSR configurados.
- Esquema inicial creado en Supabase.
- Seed con centros y productos ficticios ejecutada.
- Pantalla inicial estática.
- Función de cálculo de cantidades abiertas con tests.
- No hay autenticación, políticas RLS, operaciones de negocio ni pantallas funcionales.

## Fase 0 — Ordenar la conexión y el historial de base

### Tareas

- [x] Confirmar que la URL y la publishable key del proyecto remoto están disponibles en el entorno y nunca se imprimen en el repositorio.
- [ ] Confirmar el `project-ref` del proyecto remoto de desarrollo.
- [ ] Crear `supabase/config.toml` sin levantar una base local.
- [ ] Comparar el esquema remoto con `supabase/migrations/202609180001_initial_schema.sql`.
- [ ] Resolver la diferencia entre la ejecución manual en SQL Editor y el historial de migraciones antes de usar `db push`.
- [ ] Agregar scripts documentados para `migration:run` y una carga de seed explícitamente destinada a desarrollo.

### Criterio de finalización

El equipo puede identificar con claridad el proyecto remoto objetivo y aplicar cambios futuros sin repetir ni sobrescribir la migración inicial.

## Fase 1 — Tipos, cliente y estructura de acceso a datos

### Tareas

- [ ] Generar tipos TypeScript desde el esquema remoto.
- [x] Separar el cliente de Supabase para Server Components y middleware.
- [x] Implementar consultas iniciales para perfiles, centros y productos.
- [x] Validar entradas de creación de solicitudes con Zod.
- [ ] Evitar exponer claves privilegiadas en variables `NEXT_PUBLIC_*`.

### Criterio de finalización

La aplicación puede consultar datos permitidos desde el servidor con tipos consistentes y errores controlados.

## Fase 2 — Autenticación y perfiles

### Tareas

- [x] Implementar login y logout.
- [x] Implementar middleware para renovar la sesión y proteger rutas privadas.
- [ ] Crear el flujo para asociar un usuario de Supabase Auth con `profiles`.
- [ ] Implementar los roles `admin` y `pharmacist`.
- [ ] Implementar `must_change_password` para el primer acceso.
- [ ] Crear una pantalla de sesión expirada y manejo de usuarios inactivos.

### Criterio de finalización

Un usuario autenticado puede iniciar sesión, cambiar su contraseña cuando corresponde y acceder solo a las rutas de su rol.

## Fase 3 — Seguridad y políticas RLS

### Tareas

- [ ] Definir qué centros puede consultar y operar cada rol.
- [x] Crear políticas RLS iniciales para `profiles`, `health_centers` y `products`.
- [x] Crear políticas RLS iniciales para `requests` y `request_items`.
- [ ] Crear políticas RLS para `deliveries` y `delivery_items`.
- [ ] Restringir `audit_events` a lectura administrativa y escritura controlada.
- [ ] Revisar las políticas con usuarios de prueba de cada rol.
- [ ] Confirmar que ningún acceso depende de `service_role` desde el frontend.

### Criterio de finalización

Las operaciones permitidas funcionan con la clave pública y las operaciones no autorizadas son rechazadas por la base, no solo por la interfaz.

## Fase 4 — Catálogos y administración

### Tareas

- [ ] Crear pantalla administrativa de centros.
- [ ] Crear pantalla administrativa de productos.
- [ ] Permitir activar/desactivar centros y productos sin borrar históricos.
- [ ] Validar nombres, presentaciones y duplicados.
- [ ] Mostrar estados y errores de guardado.

### Criterio de finalización

Un administrador puede mantener catálogos y los usuarios operativos solo ven registros activos autorizados.

## Fase 5 — Solicitudes

### Tareas

- [x] Crear formulario de nueva solicitud.
- [x] Permitir seleccionar productos y cantidades enteras positivas.
- [x] Evitar productos repetidos mediante un ítem por producto.
- [x] Guardar solicitud y sus ítems mediante una función RPC transaccional.
- [ ] Crear listado filtrable por centro, fecha y estado.
- [ ] Crear detalle de solicitud con cantidades solicitadas, entregadas, cerradas y abiertas.
- [ ] Definir estados visibles de la solicitud y sus transiciones válidas.

### Criterio de finalización

Un farmacéutico puede crear y consultar solicitudes de su centro; un administrador puede consultar las solicitudes autorizadas.

## Fase 6 — Entregas, cierres y anulaciones

### Tareas

- [ ] Crear flujo para registrar una entrega parcial o total.
- [ ] Validar que la suma de entregas activas y cantidades cerradas no supere lo solicitado.
- [ ] Implementar funciones SQL o RPC transaccionales para evitar carreras concurrentes.
- [ ] Permitir cerrar cantidades no entregadas con motivo obligatorio.
- [ ] Implementar anulación de entregas sin destruir el historial.
- [ ] Recalcular el saldo abierto desde datos persistidos.
- [ ] Cubrir reglas de cantidades con tests unitarios e integración contra el proyecto de desarrollo.

### Criterio de finalización

No se pueden registrar sobreentregas ni modificaciones inconsistentes, incluso con solicitudes concurrentes.

## Fase 7 — Auditoría e historial

### Tareas

- [ ] Definir acciones auditables y formato de `before_data`/`after_data`.
- [ ] Registrar actor, operación, entidad, motivo y fecha en cada cambio relevante.
- [ ] Hacer que la auditoría se escriba dentro de la misma transacción de negocio.
- [ ] Restringir modificación y borrado de eventos de auditoría.
- [ ] Crear consulta administrativa del historial por entidad, usuario y fecha.

### Criterio de finalización

Cada creación, entrega, cierre, anulación y cambio administrativo importante deja un registro consultable e inmutable.

## Fase 8 — Calidad, despliegue y operación

### Tareas

- [ ] Agregar tests de validaciones, permisos y flujos principales.
- [ ] Ejecutar `typecheck`, lint, tests y build en CI.
- [ ] Configurar variables de entorno separadas para desarrollo remoto, staging y producción.
- [ ] Definir procedimiento de revisión y aplicación de migraciones remotas.
- [ ] Crear datos de prueba y usuarios de prueba documentados.
- [ ] Revisar logs, errores de autenticación y errores de base.
- [ ] Documentar recuperación ante errores y respaldo antes de cambios destructivos.
- [ ] Realizar una prueba de aceptación completa con usuarios de cada rol.

### Criterio de finalización

La aplicación puede desplegarse con un procedimiento repetible, tiene cobertura de los flujos críticos y cuenta con controles básicos de operación.

## Orden recomendado de ejecución

1. Fase 0: conexión e historial remoto.
2. Fase 1: tipos y acceso a datos.
3. Fase 2: autenticación.
4. Fase 3: RLS.
5. Fase 4: catálogos.
6. Fase 5: solicitudes.
7. Fase 6: entregas y cierres.
8. Fase 7: auditoría.
9. Fase 8: calidad y despliegue.

## Primer entregable funcional recomendado

Login de administrador y farmacéutico, políticas RLS mínimas, consulta de centros/productos y creación de una solicitud básica. Después se incorporan entregas, cierres y auditoría.
