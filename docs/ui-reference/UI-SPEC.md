# Solicitudes de Farmacia — UI Specification

## 1. Objetivo

Definir la interfaz desktop del perfil FARMACÉUTICA.

Las imágenes de `docs/ui-reference/` son referencias visuales.
Este documento define comportamiento, estructura y contenido.

Si existe una contradicción:

1. UI-SPEC.md define comportamiento.
2. DESIGN-SYSTEM.md define estilos.
3. Los PNG definen composición visual de referencia.

## 2. Alcance

Perfil cubierto:

- Farmacéutica.

Pantallas:

- Inicio.
- Solicitudes.
- Nueva solicitud.
- Detalle de solicitud.
- Catálogo.
- Detalle de producto.

## 3. Fuera de alcance

No implementar desde estas referencias:

- Administración.
- Usuarios.
- Gestión de centros.
- Registro de entregas.
- Correcciones administrativas.
- Reportes.
- Mobile específico.

## 4. Layout global

Todas las pantallas autenticadas utilizan:

- Sidebar persistente izquierdo.
- Área principal de contenido.
- Identificación de usuario y centro (en la parte inferior del sidebar).
- Ancho de contenido responsive dentro del área disponible.

No existe header superior (topbar) ni breadcrumbs.

El sidebar no cambia de estructura entre pantallas.

## 5. Navegación Farmacéutica

Orden:

1. Inicio
2. Solicitudes
3. Nueva solicitud
4. Catálogo

El item correspondiente a la ruta actual debe mostrarse activo.

Parte inferior:

- Nombre de usuario.
- Cerrar sesión.

## 6. Inicio

Referencia:
`01-dashboard.png`

### Objetivo

Permitir que la farmacéutica entienda rápidamente el estado de las
solicitudes de su centro e iniciar una nueva.

### Header

Mostrar:

- Saludo según la hora de Argentina: "Buenos días" (6–12), "Buenas tardes" (12–20)
  o "Buenas noches" (resto), seguido de ", {nombre}".
- Nombre del centro.
- Botón "Nueva solicitud".

### Indicadores

Mostrar:

- Pendientes.
- Entregas parciales.
- Completadas.

### Solicitudes recientes

Mostrar las solicitudes más recientes.

Columnas:

- Número.
- Fecha.
- Productos.
- Estado.
- Último movimiento.
- Acción "Ver".

"Ver" navega a `/solicitudes/{id}`.

### Productos pendientes de recibir

Mostrar productos que todavía poseen cantidad pendiente.

Cada elemento muestra:

- producto;
- solicitud;
- cantidad pendiente.

## 7. Solicitudes

Referencia:
`02-solicitudes.png`

Ruta:
`/solicitudes`

### Objetivo

Consultar las solicitudes realizadas por el centro.

### Número de solicitud

Secuencia global generada por la base (`requests.request_number`).
Se muestra como `#SOL-{número}` en todas las pantallas. El filtro acepta
`1024`, `#1024`, `SOL-1024` o `#SOL-1024`.

### Filtros

- Número de solicitud.
- Estado.
- Fecha desde.
- Fecha hasta.

### Tabla

Columnas:

- Número.
- Fecha.
- Cantidad de productos.
- Estado.
- Último movimiento.
- Acción.

Debe existir paginación.

Seleccionar "Ver" navega a:
`/solicitudes/{id}`.

## 8. Nueva solicitud

Referencia:
`03-nueva-solicitud.png`

Ruta:
`/solicitudes/nueva`

Es el único flujo de creación de solicitudes (la ruta anterior `/nueva-solicitud`
redirige aquí). Para el perfil administrador, el paso 2 agrega la selección
obligatoria del centro de salud; la farmacéutica usa siempre el centro de su perfil.

Flujo de 3 pasos:

1. Seleccionar productos.
2. Revisar y confirmar.
3. Solicitud enviada.

### Paso 1

Permitir:

- buscar productos;
- filtrar por tipo de producto;
- seleccionar productos;
- indicar cantidad;
- eliminar selección.

No persistir una solicitud todavía.

### Paso 2

Mostrar resumen definitivo:

- producto;
- unidad;
- cantidad.

Permitir:

- volver;
- eliminar productos;
- agregar observación opcional (hasta 500 caracteres, `requests.observations`);
- enviar solicitud.

### Paso 3

Mostrar confirmación:

- número de solicitud;
- fecha;
- cantidad de productos.

Acciones:

- Ver solicitud.
- Nueva solicitud.

## 9. Detalle de solicitud

Referencia:
`04-solicitud-detalle.png`

Ruta:
`/solicitudes/{id}`

Esta pantalla es independiente.
NO compartir layout horizontal con el listado de solicitudes.

Sobre el título se muestra un botón "Volver" que regresa a la ruta
de origen (Inicio o Solicitudes). Si la página se abrió directamente,
navega a `/solicitudes`.

Mostrar:

- número;
- estado;
- fecha;
- último movimiento.

### Resumen

- Productos solicitados.
- Unidades solicitadas.
- Unidades entregadas.
- Unidades pendientes.
- Progreso de entrega.

### Productos

Filtros (resueltos en el servidor/base de datos):

- búsqueda por nombre o presentación del producto;
- cantidad pendiente: Todos / Con pendiente / Sin pendiente.

Los filtros afectan solo la tabla de productos; el resumen y el progreso
muestran siempre el total de la solicitud.

Columnas:

- Producto.
- Tipo.
- Unidad.
- Solicitado.
- Entregado.
- Pendiente.
- Estado.

### Observaciones

Mostrar observación original o estado vacío ("Sin observaciones.").

La observación es de solo lectura una vez enviada la solicitud: no se muestra
una acción "Editar". No aparece en el listado de Solicitudes.

### Historial

Mostrar movimientos cronológicamente.

La farmacéutica tiene acceso de consulta.
Las operaciones administrativas no deben aparecer.

## 9.1 Tipo de producto

Todo producto tiene un tipo (`products.product_type`), definido por el administrador:

- Medicamento.
- Descartable.
- Equipamiento (tensiómetros, otoscopios y similares).

Se muestra en Nueva solicitud (columna y filtro) y en el detalle (columna Tipo).
La columna "Unidad" de los mockups corresponde a la presentación del producto.
Rubro y stock de referencia no forman parte del modelo.

## 9.2 Catálogo

Ruta:
`/catalogo` (solo lectura; la gestión de productos del administrador sigue en `/catalogos`).

Listado de productos activos:

- Filtros: búsqueda por nombre o presentación y tipo (resueltos en el servidor).
- Columnas: Producto, Tipo, Presentación, Acción "Ver".
- Paginación.

"Ver" navega a `/catalogo/{id}`.

### Detalle de producto

Ruta:
`/catalogo/{id}`

Muestra los datos del producto: nombre, tipo y presentación.
Incluye el botón "Volver". Sin acciones adicionales.

## 10. Estados visuales

Estados generales:

- Pendiente
- Entrega parcial
- Completada
- Cerrada

Regla (se calcula en la base de datos, sobre la suma de los ítems para una
solicitud y por ítem para cada producto):

| Pendiente | Entregado | Estado |
|---|---|---|
| > 0 | = 0 | Pendiente |
| > 0 | > 0 | Entrega parcial |
| = 0 | > 0 | Completada |
| = 0 | = 0 | Cerrada (todo cerrado sin entregas) |

Pendiente = solicitado − entregado (entregas activas) − cerrado.

Dónde se muestra:

- Inicio: indicadores Pendientes, Entregas parciales y Completadas; cada uno
  navega al listado filtrado por ese estado. Columna Estado en recientes.
- Solicitudes: columna Estado y filtro por estado.
- Detalle: estado de la solicitud junto al título y columna Estado por producto.

El significado funcional no debe inferirse únicamente del color.

## 11. Estados de interfaz

Todas las vistas de datos deben contemplar:

- loading;
- empty;
- error;
- success cuando corresponda.

No mostrar tablas vacías sin explicación.

## 11.1 Filtros y búsquedas (estándar de la aplicación)

Todo filtro o búsqueda de la aplicación sigue estas reglas:

- El filtrado se resuelve en el servidor / base de datos, nunca filtrando
  en el cliente una colección ya descargada.
- El estado de los filtros vive en la URL (query string), de modo que
  sea compartible, recargable y compatible con volver atrás.
- Las búsquedas de texto se aplican tras 300 ms sin escribir y no
  distinguen mayúsculas (`ilike`), escapando comodines.
- Cambiar un filtro reinicia la paginación.
- Los valores derivados que se filtran (ej. cantidad pendiente) se calculan
  en la base (columnas computadas), no en el frontend.
- Mientras se resuelve la consulta se muestra un skeleton o se atenúa el
  contenido; sin resultados se muestra un EmptyState con
  "Probá modificando los filtros aplicados."

Implementación de referencia: `src/hooks/use-url-filters.ts` (cliente) y
`src/lib/filters.ts` (servidor).

## 12. Restricciones

- No inventar acciones.
- No agregar datos que el backend no provea.
- No implementar funcionalidades administrativas.
- No modificar reglas de negocio para satisfacer el mockup.
- No hardcodear información del usuario o centro.
- No duplicar componentes visualmente equivalentes.
