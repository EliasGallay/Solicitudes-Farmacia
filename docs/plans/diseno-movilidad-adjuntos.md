# Diseño: archivos de evidencia en Movilidad

Fecha: 2026-10-29. Extiende `docs/plans/diseno-movilidad.md` (que dejaba los adjuntos para una segunda
etapa). Las decisiones marcadas **(decisión técnica)** las tomó quien escribió el documento; el usuario
puede revisarlas.

## Para qué

Que cada reparación o mantenimiento tenga su respaldo (presupuesto, factura, fotos y la documentación que
haga falta) guardado junto al vehículo, en vez de perdido en mails o carpetas. Dentro de un año, al mirar
una reparación en el historial, tiene que estar también su presupuesto y su factura.

## Objetivos

- Adjuntar archivos a una **solicitud de servicio** en cualquier momento: al pedirla, en compras, al
  completarla y también después de cerrada (la factura puede llegar tarde).
- Adjuntar archivos a un **registro del historial** (mantenimiento o reparación) en cualquier momento.
- El registro que cerró una solicitud muestra también los archivos de esa solicitud.
- Cada archivo se **clasifica** con un tipo de una lista guardada en la base; si no está en la lista, se
  elige «Otro» y se escribe el tipo en texto libre.
- Suben el admin y los usuarios de Movilidad.
- Borra solo **quien lo subió o el admin**. El borrado es **lógico**: el archivo deja de mostrarse, pero
  sigue guardado (en la tabla y en Storage) con quién lo borró y cuándo, y queda en la auditoría.

## Fuera de alcance

- Pantalla para administrar la lista de tipos: se carga en la migración y se cambia por SQL
  **(decisión técnica)**.
- Vista previa embebida de PDF, edición o reemplazo de archivos, descarga en lote.
- Mostrar o recuperar archivos borrados desde la app.
- Notificaciones por archivos subidos o borrados **(decisión técnica)**.

## Anti-objetivos

- Que un usuario sin el rubro Movilidad pueda ver o bajar un archivo, aunque tenga el enlace.
- Que se pierda un archivo: nada se elimina de Storage desde la app.

## Tipos de documento

Tabla en la base, con orden de presentación **(decisión técnica sobre la lista inicial)**:

| Clave | Nombre |
|---|---|
| `budget` | Presupuesto |
| `invoice` | Factura |
| `delivery_note` | Remito |
| `work_order` | Orden de trabajo |
| `technical_report` | Informe técnico o diagnóstico |
| `photo_before` | Foto antes del trabajo |
| `photo_after` | Foto del trabajo terminado |
| `warranty` | Garantía |
| `payment_receipt` | Comprobante de pago |
| `other` | Otro (pide texto libre, obligatorio, hasta 60 caracteres) |

Los tipos tienen `active` para poder retirarlos sin perder los archivos que ya los usan.

## Archivos (decisión técnica)

- JPG, PNG, WebP o PDF, hasta 10 MB cada uno. Las fotos se achican en el navegador antes de subir, con
  el mismo método que el remito firmado (`src/components/deliveries/signed-note-input.tsx`).
- Varios archivos por envío; todos los del envío llevan el mismo tipo. El navegador los manda de a uno a
  la server action (cada uno hasta 10 MB), así que `serverActions.bodySizeLimit` en `next.config.ts` pasa
  de 6 MB a 11 MB; si uno falla, se informa cuál y los demás quedan subidos.
- Bucket privado `movilidad-evidencias`, ruta `<solicitud|registro>/<id>/<uuid>.<ext>`; nombre aleatorio,
  y se guarda aparte el nombre original para mostrarlo.
- Se abren por `/movilidad/archivos/<id>`, que exige Movilidad, lee el archivo con RLS (un borrado no
  aparece) y redirige a un enlace firmado de 60 segundos. Así se cumple el anti-objetivo: un enlace
  compartido no sirve sin el rubro ni después del borrado **(decisión técnica, tras la revisión)**.
- Un archivo pertenece a una solicitud **o** a un registro, nunca a los dos. El registro que cerró una
  solicitud muestra los suyos y los de la solicitud, marcados de dónde vienen.
- Se puede adjuntar aunque el vehículo esté desactivado o el registro anulado: es documentación de algo
  que ya pasó.

## Permisos

| Acción | Admin | Usuario con rubro Movilidad | Otros |
|---|---|---|---|
| Ver y bajar archivos | Sí | Sí | No |
| Subir | Sí | Sí | No |
| Borrar (lógico) | Cualquiera | Solo los que subió | No |

En la base: RLS sobre la tabla y sobre `storage.objects` del bucket (lectura solo de archivos registrados
y no borrados, para admin o `has_area('fleet')`); el alta y el borrado pasan por RPCs `security definer`
que validan, escriben la auditoría y nunca borran el objeto de Storage. Como en los remitos, solo se puede
eliminar de Storage un objeto que nunca llegó a registrarse (si el registro falla después de subirlo).

## Pantallas

- Detalle de la solicitud de servicio (`/movilidad/solicitudes/[id]`): tarjeta «Archivos» con la lista
  (tipo, nombre, quién y cuándo, ver, borrar si corresponde) y el formulario para adjuntar (tipo, texto
  libre si es «Otro», archivos).
- Ficha del vehículo (`/movilidad/vehiculos/[id]`): cada registro del historial muestra sus archivos y,
  si cerró una solicitud, también los de esa solicitud; un botón «Adjuntar» por registro abre el mismo
  formulario.
- Borrar pide confirmación.

## Restricciones del proyecto que aplican

Las mismas de `docs/plans/diseno-movilidad.md`: autorización doble, helpers internos revocados de `anon` y
`authenticated`, feedback por códigos, límites iguales en Zod y en la base, nada se borra, migración a
mano, textos en castellano rioplatense. Verificación: ampliar `supabase/checks/movilidad.sql`, que ahora
corre también contra el Supabase local (`npx supabase start`).

## A criterio de quien construye

Nombres de tablas, RPCs y componentes; diseño visual dentro del sistema existente; reparto en archivos.
