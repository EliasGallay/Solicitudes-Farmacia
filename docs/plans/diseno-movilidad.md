# Diseño: módulo Movilidad (flota de vehículos)

Fecha: 2026-10-28. Surge de una conversación de diseño con el usuario; las decisiones marcadas como
**(decisión técnica)** las tomó quien escribió el documento y el usuario puede revisarlas.

## Para qué

La Secretaría de Salud tiene una flota chica (ambulancias y otros vehículos). Hoy no hay un lugar
único donde ver qué vehículos hay ni qué se le hizo a cada uno. El módulo tiene que responder,
para cualquier vehículo y en cualquier momento, **qué se reparó, cuándo y dónde**, y hacer que los
pedidos de reparación sigan el mismo circuito que ya conocen para los insumos: alguien pide, el admin
revisa y pide a compras, y queda constancia de todo.

## Objetivos

- Registro de vehículos: nombre, marca, modelo, año, dominio (patente) e identificador interno
  (p. ej. «Blanco 01», «Blanco 02»).
- Historial por vehículo con los mantenimientos y reparaciones: qué se hizo, cuándo y dónde (taller).
- Solicitud de servicio/reparación: como las de insumos, pero con **texto libre** en lugar de
  selector de productos.
- El admin revisa la solicitud y carga el **número de requerimiento de compra**.
- Al terminar la reparación, se carga lo que se hizo y eso **cierra la solicitud y queda en el
  historial** del vehículo, vinculado a la solicitud.
- Los mantenimientos de rutina que no necesitan compra se cargan **directo en el historial**, sin
  solicitud.

## Fuera de alcance (por ahora)

- Adjuntos (foto de factura o presupuesto). **(decisión técnica: quedó sin respuesta; se deja para
  una segunda etapa reutilizando el patrón del bucket de remitos firmados).**
- Costos, kilometraje, vencimientos (VTV, seguro, service por km), turnos de taller, choferes.
- Métricas de flota en el panel del admin, hoja imprimible de la solicitud.
- Vehículos de otras dependencias: solo se registran los de Salud, todos a cargo de Movilidad.

## Anti-objetivos

- Que el módulo de insumos se vea afectado: un usuario de farmacia no tiene que ver nada de vehículos,
  y un usuario de Movilidad no tiene que ver un catálogo de productos vacío ni un «Nueva solicitud»
  de insumos que no le corresponde.
- Que se pueda borrar historia: como en el resto de la app, nada se elimina; se desactiva o se anula
  con motivo.

## Quién es quién

- **Movilidad** es una dependencia más, como los centros de salud y Protección Civil. El admin la crea
  en `/centros` (es un dato, no código) y le asigna usuarios.
- **Acceso al módulo (decisión técnica):** por **rubro**, el mecanismo de permisos que ya existe. Se
  agrega el rubro `fleet` con nombre «Movilidad». Los usuarios de la dependencia Movilidad tienen ese
  rubro (y pueden tener otros si también piden insumos). En la base, `has_area('fleet')`; en la app,
  `requireArea('fleet')`. El admin ve todo, como siempre.
- Para que el rubro Movilidad no aparezca en catálogos, nueva solicitud de insumos, filtros de rubro,
  etc., los rubros pasan a tener un tipo: `areas.kind` = `supplies` (los actuales) o `fleet`.

| Acción | Admin | Usuario con rubro Movilidad |
|---|---|---|
| Ver vehículos, historial y solicitudes de servicio | Sí | Sí |
| Alta, edición y desactivación de vehículos | Sí | No |
| Cargar mantenimiento o reparación en el historial | Sí | Sí |
| Crear solicitud de servicio | Sí | Sí |
| Cargar/corregir requerimiento de compra | Sí | No |
| Completar la solicitud (carga la reparación) | Sí | Sí |
| Cancelar la solicitud con motivo | Sí | Sí **(decisión técnica)** |
| Anular un registro del historial con motivo | Sí | No **(decisión técnica)** |

## Vehículos

- Campos: nombre (obligatorio), marca, modelo, año, dominio, identificador interno.
- **(decisión técnica)** Dominio obligatorio y único; se guarda en mayúsculas y sin espacios ni
  guiones; acepta formato viejo (`ABC123`) y Mercosur (`AB123CD`). Marca, modelo y año obligatorios;
  año entre 1950 y el año siguiente al actual. Identificador interno opcional y único sin distinguir
  mayúsculas cuando está.
- Un vehículo no se borra: se desactiva. Un vehículo inactivo conserva su historial y no se puede
  elegir en una solicitud nueva ni recibir registros nuevos. **(decisión técnica)** No se puede
  desactivar un vehículo con solicitudes abiertas (Pendiente o En compras): primero se completan o
  se cancelan.
- Se muestra como «Blanco 01 · Ambulancia Mercedes Sprinter (AB123CD)»: identificador primero cuando
  existe, porque es como lo nombran.

## Historial del vehículo

- Cada registro: tipo (**Mantenimiento** o **Reparación**), qué se hizo (texto libre), cuándo (fecha,
  no futura) y dónde (taller o lugar, texto libre). Se guarda automáticamente quién lo cargó y cuándo.
- Si el registro cierra una solicitud, queda vinculado a ella y el historial muestra el enlace.
- Línea de tiempo de más reciente a más antiguo, por fecha del trabajo.
- **(decisión técnica)** Sin edición: un registro equivocado lo anula el admin con motivo (queda
  visible como anulado) y se carga de nuevo. Si el registro anulado había cerrado una solicitud, la
  solicitud vuelve a abrirse. Es el mismo criterio que las entregas anuladas.

## Solicitud de servicio

- Datos: vehículo (activo), descripción del problema (texto libre, obligatorio), numeración propia
  (`SRV-15`) **(decisión técnica: numeración separada de las solicitudes de insumos)**.
- Estado calculado, nunca editado a mano:

| Estado | Cuándo |
|---|---|
| Pendiente | Recién creada, sin requerimiento de compra. |
| En compras | Tiene número de requerimiento de compra. |
| Completada | Tiene un registro de historial activo que la cerró. |
| Cancelada | Se canceló con motivo. |

- Requerimiento de compra: igual que en insumos (texto de 1 a 30 caracteres, no único, corregible
  mientras la solicitud esté abierta, solo el admin).
- Completar: formulario con qué se reparó, cuándo y dónde. Crea el registro de tipo Reparación en el
  historial y la solicitud pasa a Completada. Se puede completar desde Pendiente o En compras.
- Cancelar: con motivo, mientras esté abierta.

## Notificaciones y auditoría

- Toda operación escribe en `audit_events` (alta/edición/desactivación de vehículos, registros,
  anulaciones, solicitudes y sus cambios), y la auditoría global la muestra con enlace.
- **(decisión técnica)** Se notifica: solicitud creada, requerimiento de compra cargado, solicitud
  completada y cancelada. Destinatarios: admins activos y usuarios activos con rubro Movilidad, salvo
  quien hizo la operación. Los mantenimientos de rutina no notifican.

## Pantallas (decisión técnica)

Bajo `/movilidad`, con un ítem «Movilidad» en el menú lateral para el admin y para quienes tengan el
rubro:

- `/movilidad`: listado de vehículos (buscador por nombre, identificador o dominio; filtro
  activos/inactivos) y acceso a las solicitudes.
- `/movilidad/vehiculos/nuevo` y `/movilidad/vehiculos/[id]/editar` (admin).
- `/movilidad/vehiculos/[id]`: ficha del vehículo con su historial y sus solicitudes; botones «Cargar
  mantenimiento» y «Pedir reparación».
- `/movilidad/solicitudes`: listado con filtros por estado y vehículo y buscador.
- `/movilidad/solicitudes/nueva`: elegir vehículo y describir el problema.
- `/movilidad/solicitudes/[id]`: detalle con requerimiento de compra (admin), completar y cancelar.

Si un usuario solicitante tiene **solo** el rubro Movilidad, el menú oculta Solicitudes, Por confirmar,
Nueva solicitud y Catálogo de insumos, y el inicio lo lleva a `/movilidad`.

## Restricciones del proyecto que aplican

- Autorización doble: guard en cada página y server action, y RLS + RPC `security definer` en la base.
- Las RPCs internas se revocan de `anon` y `authenticated`, no solo de `public` (ver la revisión de
  seguridad del 2026-10-28).
- Feedback por códigos en la URL (`withFeedback`, `src/lib/feedback.ts`); errores de RPC traducidos
  con `managementErrorCode()`.
- Filtros y búsqueda resueltos en el servidor con estado en la URL (`src/lib/filters.ts`,
  `src/hooks/use-url-filters.ts`), con columnas `*_search_text` normalizadas.
- Zod en cliente y servidor con los mismos límites que los `check` de la base.
- Colores solo por tokens semánticos; reutilizar los componentes de `src/components`.
- Migraciones aplicadas a mano en el SQL Editor; textos en castellano rioplatense.

## Lo que queda a criterio de quien construye

- Nombres exactos de tablas, columnas, RPCs y componentes.
- Diseño visual de cada pantalla, dentro del sistema de diseño existente.
- Cómo se reparten las migraciones en archivos.
