# Plan — Ajuste responsive de todas las pantallas

Estado al 2026-09-25, rama base `develop`. **Implementado** (sin commit), salvo lo indicado.
Objetivo: que todas las pantallas se vean y usen bien desde 320px hasta desktop, sin
overflow horizontal de página y con las acciones principales siempre accesibles.
Se resuelve por fases, en orden. Marcar cada ítem al cerrarlo e indicar la decisión tomada.

## 0. Diagnóstico

Viewports de referencia: **320, 375, 414** (mobile), **768** (tablet), **1024, 1280** (desktop chico), **1440**.

Problemas detectados en el código:

| # | Dónde | Problema |
|---|-------|----------|
| D1 | `app-shell.tsx`, `sidebar.tsx` | El sidebar fijo (250px) aparece desde `md` (768px): entre 768 y 1023px el contenido queda en ~518px útiles y las tablas y filtros se comprimen. Es la "resolución chica" que peor se ve. |
| D2 | `sidebar.tsx` `MobileNavigation` | Debajo de `md` hay una tira horizontal con scroll que incluye los ítems y "Cerrar sesión". No muestra la marca ni el usuario o centro, no indica que hay más ítems ocultos y el ítem activo puede quedar fuera de la vista. Está marcada en el código como "fallback básico". |
| D3 | `page-header.tsx` | `h1` en `text-3xl` en todos los tamaños. En mobile, el saludo del Inicio ("Buenas tardes, Nombre Apellido") y "Solicitud #SOL-n + badge" ocupan 2–3 líneas. El botón de acción queda desalineado cuando pasa a la línea siguiente. |
| D4 | Tablas (`requests-table`, `request-products-table`, `new-request-wizard`, `catalogo/page`) | Solo hay `overflow-x-auto`. El detalle tiene 7 columnas y en mobile se lee todo con scroll lateral. En el paso 1 del wizard, la columna Cantidad (stepper de ~170px o botón `w-36`) le quita espacio al nombre del producto. |
| D5 | Filtros (`request-filters`, `catalog-filters`, wizard, `request-product-filters`) | Anchos fijos: `min-w-64`/`min-w-56` en la búsqueda, `w-48` en los selects, `w-44` en las fechas y `w-64` en la búsqueda del detalle. A 320px (288px útiles menos el padding de la card) se desbordan o quedan desparejos, y el ToggleGroup de 3 opciones no entra al lado de la búsqueda. |
| D6 | `page-skeletons.tsx` | Anchos fijos (`w-80`, `w-64`, `w-44`): el skeleton del header mide 320px y genera scroll horizontal durante la carga en mobile. |
| D7 | `(app)/page.tsx` Inicio | Las métricas pasan a 3 columnas en `sm` (640px). Con el sidebar, entre 768 y 1023px las tres cards comparten ~518px con número `text-3xl` + ícono + chevron. Lo mismo pasa con el skeleton. |
| D8 | `request-stepper.tsx` | 3×80px + 2×24px = 288px: entra justo a 320px sin margen. Los labels ocupan 2 líneas. |
| D9 | `list-footer.tsx`, `ui/pagination.tsx` | Resumen, selector de filas y paginación se apilan sin orden claro. Los botones de página miden 32px (`icon-xs`), debajo del mínimo táctil recomendado de 44px. |
| D10 | Wizard, acciones del paso | "Siguiente" y "Enviar solicitud" quedan al final de listados largos. En mobile hay que scrollear hasta abajo para avanzar y no se ve cuántos productos se agregaron. |
| D11 | Admin (`catalogos`, `product-form`) | Formulario en `md:grid-cols-[1fr_1fr_12rem_auto]`, que se comprime entre 768 y 1023px con el sidebar. Usa tokens viejos (`bg-card`, `text-muted-foreground`). Lo mismo en `change-password`. |

## 1. Decisiones previas (bloqueantes)

`DESIGN-SYSTEM.md §25` y `UI-SPEC.md §4` hoy dicen: "no diseñar mobile específico", "no
existe topbar" y "no modificar desktop". Hay que definir lo siguiente antes de implementar y
después actualizar esos documentos.

- [x] **1.1 Navegación mobile.** Decisión: barra superior + drawer (`<dialog>` nativo, sin dependencias). Recomendado: **barra superior compacta solo debajo de `lg`**,
  con la marca y un botón de menú que abre un **drawer** con el mismo contenido del sidebar
  (ítems, usuario y centro, "Cerrar sesión"). Desktop no cambia. Alternativa: barra inferior
  fija con 4 ítems (solo sirve para farmacéutica; admin tiene 7).
- [x] **1.2 Breakpoint del sidebar.** Decisión: `lg`. Recomendado: pasar de `md` a **`lg` (1024px)**. Entre 768
  y 1023px se usa la navegación de 1.1 y el contenido gana 250px. Resuelve D1, D7 y D11 casi
  sin tocar las pantallas.
- [x] **1.3 Tablas en mobile.** Decisión: `MobileList` debajo de `md`; en el detalle, entre `md` y `xl`
  Tipo y Presentación pasan como subtítulo del producto. Recomendado: **lista de cards debajo de `md`** para los
  listados principales (Solicitudes, Inicio, productos del detalle, paso 1 y paso 2 del
  wizard, Catálogo), manteniendo la `<Table>` desde `md`. Alternativa más barata: seguir
  con scroll horizontal y ocultar columnas secundarias (Tipo y Presentación pasan como
  subtítulo bajo el nombre).
- [x] **1.4 Alcance admin.** Decisión: solo overflow y tokens. Recomendado: solo evitar overflow y unificar tokens en
  `catalogos`, `product-form` y `change-password`. Sin rediseño, porque el admin está fuera
  del alcance UI.

## 2. Base: shell y componentes compartidos

Resuelve la mayor parte del problema en todas las pantallas a la vez.

- [x] **2.1 Shell** (`app-shell.tsx`, `sidebar.tsx`): aplicar 1.1 y 1.2. Nuevo componente
  `ui/sheet.tsx` (drawer accesible: foco atrapado, `Esc`, cierre al navegar, `aria-expanded`).
  Reutilizar `Navigation`, el bloque de usuario y `LogoutButton` entre el sidebar y el drawer.
  El drawer se cierra al cambiar de `pathname`.
- [x] **2.2 Padding del `main`:** `px-4 py-5 sm:px-6 lg:p-8`. Agregar `min-w-0` donde falte
  para que los hijos flex/grid no fuercen el ancho.
- [x] **2.3 `PageHeader`:** `text-2xl leading-8 sm:text-3xl sm:leading-10`. Las acciones pasan
  a `w-full sm:w-auto`, con el botón a ancho completo en mobile.
- [x] **2.4 `Table`:** `whitespace-nowrap` en las celdas numéricas y de acción, con padding
  lateral menor en mobile. Si se elige la alternativa de 1.3: helper de columnas ocultables
  (`hidden md:table-cell`).
- [x] **2.5 Lista responsive** (si 1.3 = cards): componente `ResponsiveList`/`MobileCard` con
  título, subtítulo, pares clave-valor y acción. Mismo contenido y mismo orden que la tabla.
- [x] **2.6 `ListFooter` y `Pagination`:** en mobile, resumen arriba y controles abajo
  (`flex-col sm:flex-row`). Botones de página de 40px mínimo en táctil. Menos páginas
  visibles debajo de `sm` (anterior · actual/total · siguiente).
- [x] **2.7 Filtros:** patrón común `grid gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap`, con los
  inputs y selects a `w-full` en mobile y el ancho actual desde `lg`. "Limpiar filtros" a
  ancho completo en mobile. Aplica a `request-filters`, `catalog-filters`, los filtros del
  wizard y `request-product-filters` (el ToggleGroup pasa a ancho completo en una fila propia).
- [x] **2.8 Skeletons:** reemplazar los anchos fijos por `w-full max-w-*` y replicar los mismos
  breakpoints que las pantallas reales.

## 3. Pantallas farmacéutica

- [x] **3.1 Inicio** (`(app)/page.tsx`): métricas en `grid-cols-1 sm:grid-cols-3` revisado
  según 1.2 (o `lg:grid-cols-3`). "Últimas solicitudes" como lista en mobile. "Productos
  pendientes" ya es lista: verificar truncado y alineación del número.
- [x] **3.2 Solicitudes** (`solicitudes/page.tsx`): filtros (2.7), tabla o lista (1.3) y
  footer (2.6).
- [x] **3.3 Detalle** (`solicitudes/[id]/page.tsx`): header con badge debajo del título en
  mobile. Métricas en `grid-cols-2` también en mobile (cards compactas: ícono más chico,
  `text-2xl`). Header de la card "Productos" con los filtros apilados. Tabla de 7
  columnas → lista con Solicitado/Entregado/Pendiente en fila.
- [x] **3.4 Nueva solicitud, paso 1:** filtros (2.7). Cada producto en mobile es una card con
  nombre, tipo y presentación y el stepper o "Agregar" a ancho completo abajo. **Barra de
  acción fija inferior en mobile** (`sticky bottom-0`) con "N productos agregados" y
  "Siguiente" (D10).
- [x] **3.5 Nueva solicitud, paso 2:** lista de seleccionados en cards. Selector de centro
  (admin) a `w-full`. Barra fija con "Volver" y "Enviar".
- [x] **3.6 Paso 3 y `RequestStepper`:** en mobile, labels cortos o solo el label del paso
  activo, y conectores flexibles (`flex-1`) en lugar de `w-6`.
- [x] **3.7 Catálogo** (`catalogo/page.tsx`, `catalogo/[id]`): filtros, lista y footer. El
  detalle ya usa `sm:grid-cols-3`: solo verificar.

## 4. Pantallas públicas y admin

- [x] **4.1 Login:** además se corrigió el recorte del panel izquierdo en pantallas de poca altura
  (1366×768): alto mínimo en lugar de fijo y variante `short` que compacta el panel. ya es responsive (`lg:grid`). Verificar a 320px con teclado abierto
  (`min-h-dvh`), y el padding de la card (`p-8` → `p-6 sm:p-8`).
- [x] **4.2 Cambiar contraseña:** padding y tokens actuales.
- [x] **4.3 Admin** (`catalogos`, `product-form`, `entregas`, `usuarios`, `auditoria`): según
  1.4, formulario en `sm:grid-cols-2 xl:grid-cols-[...]` y cero overflow.

## 5. Verificación

- [x] **5.1 Checklist** (automatizado con Edge headless + emulación de dispositivo sobre una ruta de preview temporal, ya eliminada; sin overflow en 320–1440): en cada viewport de §0, por pantalla y rol: sin scroll
  horizontal de página (`document.documentElement.scrollWidth <= innerWidth`), acciones
  principales visibles, textos sin cortes indebidos, foco visible y navegación por teclado
  en el drawer.
- [ ] **5.2 Estados (parcial: verificados textos largos, skeletons y paginación con muchas páginas; vacío y error sin verificar visualmente):** vacío, error, carga (skeleton), filtros sin resultados, textos largos
  (nombre de producto y centro de 60+ caracteres) y paginación con muchas páginas.
- [ ] **5.3 (Opcional, pendiente) Test automatizado:** agregar Playwright con un test que recorra las
  rutas en 320/768/1280 y falle si hay overflow horizontal, más capturas de referencia.
- [ ] **5.4 Validación:** typecheck, lint y tests OK. Build pendiente (no se corrió con `next dev` activo).
- [x] **5.5 Docs:** actualizar `DESIGN-SYSTEM.md §25` y `UI-SPEC.md §4` con las decisiones de §1
  (breakpoints, navegación mobile, patrón de listas y barra de acción fija).

## Orden de entrega sugerido (un PR por bloque)

1. §1 decisiones + §2.1–2.3 (shell y header): es lo que más se nota y desbloquea el resto.
2. §2.4–2.8 (componentes compartidos).
3. §3.1–3.3 (Inicio, Solicitudes, Detalle).
4. §3.4–3.7 (wizard y catálogo).
5. §4 + §5.
