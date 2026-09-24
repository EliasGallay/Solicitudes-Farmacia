# Solicitudes de Farmacia — Design System

## 1. Objetivo

Este documento define el sistema visual de **Solicitudes de Farmacia**.

Su objetivo es mantener consistencia entre todas las pantallas y evitar decisiones visuales locales o arbitrarias durante la implementación.

La identidad visual utiliza como base la línea institucional **Funes Digital**: verdes institucionales, superficies claras, fondos gris verdosos y una interfaz administrativa limpia.

Las referencias visuales se encuentran en:

```text
ui-reference/
```

### Prioridad de fuentes

Ante cualquier diferencia entre documentación, mockups y código:

1. `UI-SPEC.md` define comportamiento, contenido y reglas funcionales.
2. `DESIGN-SYSTEM.md` define estilos, tokens y componentes visuales.
3. Los mockups PNG definen composición y referencia visual.
4. El código existente define las convenciones técnicas del proyecto siempre que no contradiga los puntos anteriores.

Los mockups pueden contener colores pertenecientes a una versión visual anterior.

En caso de diferencia de color entre un PNG y este documento, **prevalece siempre `DESIGN-SYSTEM.md`**.

---

# 2. Principios visuales

La interfaz debe sentirse:

- institucional;
- limpia;
- moderna;
- clara;
- consistente;
- de alta legibilidad;
- administrativa sin resultar anticuada;
- con densidad visual moderada.

La interfaz debe priorizar información y acciones sobre elementos decorativos.

La identidad institucional debe aparecer principalmente mediante:

- sidebar;
- acciones principales;
- estados activos;
- iconografía contextual;
- acentos;
- focus states;
- elementos destacados.

El resto de la interfaz debe mantenerse predominantemente claro.

## Reglas estrictas

- No utilizar gradientes decorativos.
- No utilizar sombras fuertes.
- No utilizar colores hardcodeados dentro de componentes.
- No utilizar arbitrary values de Tailwind cuando exista un token equivalente.
- No crear nuevos colores localmente.
- No crear nuevas variantes visuales de componentes sin necesidad funcional.
- No duplicar componentes visualmente equivalentes.
- Mantener consistencia de spacing, radius, tamaños y estados.
- Utilizar clases Tailwind cuando exista una utilidad equivalente.
- Evitar CSS custom para propiedades que puedan expresarse mediante Tailwind.
- No convertir toda la interfaz en monocromática verde.
- Los colores semánticos tienen prioridad sobre los colores institucionales cuando comunican estado.
- Los mockups son una referencia de composición, no una fuente de valores CSS exactos.

---

# 3. Color system

Los colores deben definirse centralmente como tokens de Tailwind.

Los componentes nunca deben depender directamente del valor hexadecimal del color.

## Theme

```css
@theme {
  /* Brand — Funes Digital */
  --color-primary-50: #f0f7f3;
  --color-primary-100: #e3f2e9;
  --color-primary-400: #69bd91;
  --color-primary-500: #307a52;
  --color-primary-600: #075a36;
  --color-primary-700: #06452b;

  /* Sidebar */
  --color-sidebar: #06452b;
  --color-sidebar-hover: #075a36;
  --color-sidebar-active: #307a52;
  --color-sidebar-foreground: #ffffff;
  --color-sidebar-muted: #c5ddd0;

  /* Surfaces */
  --color-page: #f5f8f6;
  --color-surface: #ffffff;
  --color-surface-muted: #f1f6f3;
  --color-surface-accent: #e3f2e9;

  /* Text */
  --color-foreground: #202b26;
  --color-foreground-secondary: #66756b;
  --color-foreground-muted: #849188;

  /* Borders */
  --color-border: #dce8e0;
  --color-border-strong: #c4d6ca;

  /* Success */
  --color-success: #15803d;
  --color-success-muted: #dcfce7;

  /* Warning */
  --color-warning: #b45309;
  --color-warning-muted: #fef3c7;

  /* Info */
  --color-info: #307a52;
  --color-info-muted: #e3f2e9;

  /* Danger */
  --color-danger: #dc2626;
  --color-danger-muted: #fee2e2;
}
```

## Brand

```text
primary-*
sidebar
sidebar-hover
sidebar-active
```

Utilizar para identidad visual, navegación y acciones principales.

### Jerarquía

`primary-600` es el color institucional principal.

```text
primary-600 → acciones principales
primary-700 → hover / énfasis fuerte
primary-500 → elementos secundarios
primary-400 → acentos
primary-100 → fondos institucionales suaves
primary-50  → fondos institucionales muy sutiles
```

## Surfaces

```text
page
surface
surface-muted
surface-accent
```

Uso:

```text
page            → fondo general de la aplicación
surface         → cards, formularios y contenedores
surface-muted   → headers de tablas y fondos secundarios
surface-accent  → secciones institucionales suaves
```

## Content

```text
foreground
foreground-secondary
foreground-muted
border
border-strong
```

## Semantic

```text
success
warning
info
danger
```

Los colores semánticos comunican significado funcional.

No reemplazarlos por `primary` únicamente para mantener una estética verde.

## Ejemplos correctos

```tsx
<div className="bg-page text-foreground" />

<div className="border border-border bg-surface" />

<button className="bg-primary-600 text-white hover:bg-primary-700">
  Nueva solicitud
</button>

<span className="bg-warning-muted text-warning">
  Pendiente
</span>

<span className="bg-info-muted text-info">
  Entrega parcial
</span>

<span className="bg-success-muted text-success">
  Completada
</span>
```

## No permitido

```tsx
<div className="bg-[#075A36]" />

<div className="text-[#202B26]" />

<div className="border-[#DCE8E0]" />

<div style={{ color: "#075A36" }} />

<div className="bg-green-800" />

<div className="text-emerald-700" />

<div className="text-slate-500" />
```

No utilizar colores estándar de Tailwind directamente cuando exista un token del Design System.

---

# 4. Status colors

Los estados funcionales deben utilizar siempre los mismos tokens.

## Pendiente

```text
background: bg-warning-muted
text: text-warning
```

El ámbar diferencia claramente una solicitud pendiente de una acción institucional.

## Entrega parcial

```text
background: bg-info-muted
text: text-info
```

Utiliza el verde intermedio institucional sobre una superficie verde suave.

## Completada

```text
background: bg-success-muted
text: text-success
```

## Cerrada

```text
background: bg-surface-muted
text: text-foreground-secondary
```

Neutral: la solicitud o el ítem se cerró sin entregas. No comunica éxito ni error.

## Error / acción destructiva

```text
background: bg-danger-muted
text: text-danger
```

El significado funcional nunca debe inferirse únicamente del color.

Siempre debe existir texto o información adicional que identifique el estado.

---

# 5. Typography

Utilizar la familia tipográfica ya configurada globalmente en el proyecto.

No introducir una segunda familia tipográfica exclusivamente para replicar los mockups.

## Page title

```text
font-size: 32px
line-height: 40px
font-weight: 700
color: foreground
```

Tailwind:

```text
text-3xl leading-10 font-bold text-foreground
```

## Section title

```text
font-size: 20px
line-height: 28px
font-weight: 700
```

```text
text-xl leading-7 font-bold
```

## Card title

```text
font-size: 16px
line-height: 24px
font-weight: 600
```

```text
text-base leading-6 font-semibold
```

## Body

```text
font-size: 14px
line-height: 20px
font-weight: 400
```

```text
text-sm leading-5
```

## Body strong

```text
font-size: 14px
line-height: 20px
font-weight: 600
```

```text
text-sm leading-5 font-semibold
```

## Small

```text
font-size: 12px
line-height: 16px
font-weight: 400
```

```text
text-xs leading-4
```

## Metric

```text
font-size: 32px
line-height: 36px
font-weight: 700
```

Los textos secundarios utilizan:

```text
text-foreground-secondary
```

Los textos auxiliares utilizan:

```text
text-foreground-muted
```

No utilizar `primary` como color general del texto.

---

# 6. Spacing

Utilizar la escala estándar de Tailwind equivalente a:

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

## Reglas generales

```text
Page horizontal padding: 32px
Page vertical padding: 32px

Section gap: 24px
Card gap: 16px
Form field gap: 16px
Label → control: 8px
```

No utilizar valores arbitrarios como:

```text
17px
19px
22px
27px
```

salvo que exista una razón técnica documentada.

---

# 7. Radius

Utilizar una escala limitada.

```text
sm: 6px
md: 8px
lg: 12px
xl: 16px
```

## Aplicación

```text
Button: md
Input: md
Select: md
Badge: md o pill cuando corresponda
Card: lg
Container principal: lg/xl
```

La interfaz debe tener bordes suavemente redondeados, sin adoptar una apariencia excesivamente "pill" o infantil.

---

# 8. Shadows

Las sombras deben ser sutiles.

La separación principal entre elementos debe producirse mediante:

1. espacio;
2. fondo;
3. borde;
4. sombra.

## Card

```css
0 1px 3px rgba(32, 43, 38, 0.06)
```

## Elevated

```css
0 4px 12px rgba(32, 43, 38, 0.08)
```

`elevated` debe reservarse para elementos que realmente necesiten elevación visual.

Las cards normales deben priorizar `border-border` sobre sombras visibles.

---

# 9. Button

Todos los botones deben utilizar un componente compartido.

## Default

```text
height: 40px
horizontal padding: 16px
radius: md
font-size: 14px
font-weight: 600
```

## Primary

```text
background: bg-primary-600
text: text-white
hover: bg-primary-700
```

Uso:

- acción principal de una pantalla;
- avanzar en un flujo;
- enviar formulario;
- crear solicitud.

Debe existir como máximo una acción visualmente dominante por sección funcional.

## Secondary

```text
background: bg-surface
text: text-primary-600
border: border-border
```

Hover:

```text
bg-primary-50
border-primary-100
```

Uso:

- volver;
- cancelar;
- acciones secundarias.

## Ghost

```text
background: transparent
text: text-primary-600
```

Hover:

```text
bg-primary-50
```

Uso:

- acciones de baja jerarquía;
- acciones dentro de tablas;
- navegación contextual.

## Danger

Utilizar exclusivamente para acciones destructivas.

Debe utilizar tokens `danger`, no colores institucionales.

## Estados obligatorios

- default;
- hover;
- focus;
- disabled;
- loading.

No crear estilos de botones específicos dentro de una página.

---

# 10. Input

Todos los inputs deben compartir geometría y comportamiento visual.

```text
height: 40px
radius: md
border: border-border
background: bg-surface
text: text-foreground
placeholder: text-foreground-muted
font-size: 14px
```

## Focus

```text
border-primary-500
```

con focus ring sutil basado en `primary`.

Ejemplo:

```text
focus:border-primary-500
focus:ring-primary-100
```

## Disabled

```text
background: bg-surface-muted
text: text-foreground-muted
```

## Error

Utilizar tokens `danger`.

El mensaje de error debe mostrarse debajo del campo.

No utilizar verde para representar validaciones erróneas.

---

# 11. Select

El Select debe utilizar las mismas dimensiones que Input.

```text
height: 40px
radius: md
border: border-border
background: bg-surface
font-size: 14px
```

Input y Select colocados en una misma fila deben quedar perfectamente alineados.

No crear implementaciones visualmente diferentes de Select entre pantallas.

Si el proyecto ya posee un Select compartido, extender o adaptar ese componente antes de crear uno nuevo.

---

# 12. Card

Las cards representan agrupaciones lógicas de información.

## Default

```text
background: bg-surface
border: border-border
radius: lg
shadow: card
padding: 20px
```

## Large

```text
padding: 24px
```

## Accent

Cuando una card necesite un tratamiento institucional suave:

```text
background: bg-surface-accent
border: border-border
```

No utilizar `bg-primary-600` como fondo completo de cards de contenido.

No utilizar cards innecesariamente dentro de otras cards.

No convertir cada bloque de texto en una card.

---

# 13. Table

Todas las tablas de producto deben compartir estructura visual.

## Header

```text
background: bg-surface-muted
text: text-foreground-secondary
font-size: 12px
font-weight: 600
```

## Row

```text
background: bg-surface
border-bottom: border-border
```

## Interactive row

Hover:

```text
bg-primary-50
```

solo cuando la fila completa sea interactiva.

## Cell

```text
font-size: 14px
vertical-align: middle
```

## Reglas

- No utilizar líneas verticales.
- Las acciones deben alinearse a la derecha.
- Los números de solicitud deben utilizar `font-semibold`.
- Los estados deben utilizar `StatusBadge`.
- Los valores numéricos deben mantenerse alineados consistentemente.
- No introducir colores específicos por tabla.
- Mantener alturas de fila consistentes.
- No utilizar verde en todas las celdas como decoración.

## Paginación

Todo listado paginado usa el componente compartido `ListFooter`
(`src/components/list-footer.tsx`): resumen "Mostrando X a Y de Z",
selector "Filas por página" y navegación entre páginas.

- La paginación va **pegada al listado que controla**. Si el listado está
  en una card, se ubica en `<CardFooter divided>` al final de esa card.
- `ListFooter` no impone contenedor (sin borde ni padding propios): el
  encuadre lo define el listado.
- Nunca se ubica suelta al pie de la página: en pantallas con varias
  secciones quedaría ambiguo qué listado controla.

## Acciones de pantalla vs. acciones de listado

Las acciones que avanzan o cierran un flujo (por ejemplo "Siguiente",
"Volver", "Enviar solicitud" del wizard) pertenecen a la pantalla, no al
listado: se ubican **fuera de la card**, debajo, como barra propia.
Así no compiten con la paginación de la tabla.

---

# 14. Badge

Todos los estados deben utilizar un componente Badge compartido.

## Default

```text
min-height: 28px
horizontal padding: 10px
radius: md
font-size: 12px
font-weight: 500
```

## pending

```text
bg-warning-muted
text-warning
```

## partial

```text
bg-info-muted
text-info
```

## completed

```text
bg-success-muted
text-success
```

## closed

```text
bg-surface-muted
text-foreground-secondary
```

## danger

```text
bg-danger-muted
text-danger
```

No implementar estados directamente mediante clases dentro de páginas cuando exista el componente correspondiente.

Preferir:

```tsx
<StatusBadge status="pending" />
```

La traducción entre estado funcional y representación visual debe estar centralizada.

---

# 15. Sidebar

El sidebar es uno de los principales elementos de identidad institucional.

Es persistente en las pantallas autenticadas de desktop.

## Desktop

```text
width: 250px
background: bg-sidebar
foreground: text-sidebar-foreground
```

El fondo debe utilizar el verde profundo institucional.

No utilizar negro, azul o gris oscuro como sustituto.

## Estructura

Parte superior:

- identidad de la aplicación;
- referencia a Municipalidad de Funes;
- centro de salud cuando corresponda.

Navegación:

1. Inicio
2. Solicitudes
3. Nueva solicitud
4. Catálogo

Parte inferior:

- usuario autenticado y centro asignado;
- cerrar sesión.

La estructura del sidebar no debe cambiar entre pantallas.

---

# 16. SidebarItem

## Default

```text
height: 44px
radius: md
horizontal padding: 16px
text: sidebar-foreground
icon size: 20px
icon/text gap: 12px
```

Los elementos inactivos pueden utilizar `sidebar-muted` para reducir jerarquía cuando corresponda.

## Hover

```text
background: bg-sidebar-hover
text: text-sidebar-foreground
```

## Active

```text
background: bg-sidebar-active
text: text-white
```

El estado activo debe ser visible pero no excesivamente brillante.

Solo un item principal puede estar activo simultáneamente.

El estado activo debe derivarse de la ruta actual.

---

# 17. PageHeader

Utilizar un componente compartido para los encabezados principales.

Debe soportar:

- título obligatorio;
- descripción opcional;
- acciones opcionales.

## Layout desktop

```text
Título / descripción                  Acciones
```

Ejemplo:

```text
Solicitudes                         + Nueva solicitud
Visualizá todas tus solicitudes...
```

El título utiliza `text-foreground`.

Las acciones principales utilizan `primary-600`.

No utilizar fondos verdes completos detrás de PageHeader salvo que una pantalla futura lo especifique explícitamente.

La separación inferior pertenece al componente/layout y no debe redefinirse individualmente en cada página.

---

# 18. Status summary cards

Las cards de métricas utilizadas en Inicio y Detalle deben mantener una estructura consistente.

Contenido:

```text
Icono
Valor principal
Label
Descripción opcional
```

El valor debe tener la mayor jerarquía visual.

No utilizar colores saturados como fondo completo de la card.

Los colores deben utilizarse principalmente en:

- icono;
- fondo suave del icono;
- badge;
- texto semántico;
- acentos.

Para métricas institucionales sin significado de estado puede utilizarse:

```text
bg-primary-100
text-primary-600
```

---

# 19. Progress

El progreso de entrega debe representar:

```text
entregado / solicitado
```

La barra de progreso utiliza:

```text
track: bg-primary-100
progress: bg-primary-600
```

Mostrar siempre información textual además de la representación gráfica.

Ejemplo:

```text
40% entregado                         60 pendientes de 100
```

No utilizar únicamente color para comunicar progreso.

---

# 20. EmptyState

Utilizar un componente compartido cuando una colección no tenga resultados.

Debe soportar:

- icono opcional;
- título;
- descripción;
- CTA opcional.

Ejemplo:

```text
Todavía no hay solicitudes

Cuando realices una solicitud aparecerá
en este listado.

+ Nueva solicitud
```

El icono puede utilizar:

```text
background: bg-primary-100
foreground: text-primary-600
```

## Reglas

- Centrado dentro de su container.
- No utilizar ilustraciones grandes.
- No ocupar toda la pantalla cuando pertenece a una Card.
- El CTA debe utilizar Button.

Para búsquedas sin resultados:

```text
No encontramos solicitudes

Probá modificando los filtros aplicados.
```

No mostrar simplemente una tabla vacía.

---

# 21. Loading

Las vistas que dependan de datos remotos deben contemplar loading.

Preferir skeletons cuando la estructura de la pantalla ya sea conocida.

Evitar reemplazar una pantalla completa por un spinner cuando pueda conservarse su estructura.

Los skeletons deben aproximar:

- cards;
- filas;
- métricas;
- contenido textual.

Los skeletons deben utilizar superficies neutras.

No utilizar `primary` como color dominante del skeleton.

---

# 22. Error

Los errores de carga deben mostrarse dentro del contexto correspondiente.

Deben incluir:

- mensaje claro;
- acción de reintentar cuando corresponda.

Utilizar tokens `danger` cuando sea necesario comunicar visualmente el error.

No mostrar mensajes técnicos del backend directamente al usuario.

No utilizar `alert()` del navegador.

---

# 23. Icons

Utilizar la librería de iconos ya adoptada por el proyecto.

No mezclar múltiples librerías sin necesidad.

```text
Navigation: 20px
Button: 16-20px
Metric card: 24px
Inline/action: 16px
```

Los iconos institucionales pueden utilizar `primary-600`.

Los iconos sobre el sidebar utilizan `sidebar-foreground` o `sidebar-muted`.

Los iconos no deben sustituir texto cuando la acción pueda resultar ambigua.

---

# 24. Layout

Desktop es la referencia principal de esta especificación.

## Application shell

```text
┌──────────────┬─────────────────────────────────┐
│              │                                 │
│   Sidebar    │ Main content                    │
│              │                                 │
└──────────────┴─────────────────────────────────┘
```

No hay header superior (topbar) ni breadcrumbs. La identificación de
usuario y centro vive en el sidebar. La navegación de retorno se resuelve
con un botón "Volver" (Button ghost) sobre el PageHeader cuando la
pantalla lo requiera.

Implementación: el shell vive en `src/app/(app)/layout.tsx` y persiste entre
navegaciones. Toda pantalla autenticada nueva se crea dentro de `src/app/(app)/`
(sin envolverse en `AppShell`) y define un `loading.tsx` con los skeletons de
`src/components/page-skeletons.tsx`, para dar respuesta inmediata al navegar.

El sidebar mantiene ancho constante.

El contenido principal utiliza el espacio restante.

## Main content

```text
background: bg-page

padding horizontal: 32px
padding vertical: 32px
```

Las cards y superficies internas utilizan `bg-surface`.

Evitar establecer anchos fijos arbitrarios para páginas completas.

El contenido debe aprovechar correctamente el viewport disponible.

---

# 25. Responsive

La implementación debe utilizar prácticas responsive aunque los mockups actuales estén enfocados en desktop.

No diseñar una interfaz mobile específica a partir de referencias inexistentes.

En resoluciones menores:

- evitar overflow horizontal de la página;
- permitir overflow controlado en tablas cuando sea necesario;
- reorganizar grids progresivamente;
- mantener accesibles las acciones principales.

No modificar la experiencia desktop para resolver anticipadamente diseños mobile no definidos.

---

# 26. Accesibilidad

Todos los controles interactivos deben ser accesibles mediante teclado.

Requisitos mínimos:

- focus visible;
- labels asociados a inputs;
- botones con nombre accesible;
- icon buttons con `aria-label`;
- contraste suficiente;
- no comunicar estado únicamente mediante color;
- tablas con headers semánticos;
- navegación utilizando elementos apropiados.

El focus debe utilizar la identidad institucional cuando corresponda.

No eliminar outlines sin proporcionar un focus state equivalente.

---

# 27. Arquitectura de componentes

La interfaz debe construirse utilizando una arquitectura de componentes en tres niveles:

```text
shadcn/ui
    ↓
Componentes compartidos de aplicación
    ↓
Pantallas / features
```

El objetivo es evitar implementaciones visuales duplicadas y mantener una única fuente de verdad para cada primitiva o patrón reutilizable.

---

## 27.1. Primitivas UI — shadcn/ui

**shadcn/ui es la base obligatoria para los componentes UI genéricos de la aplicación cuando exista un componente equivalente.**

Antes de crear cualquier componente visual:

1. Revisar la configuración existente de shadcn/ui.
2. Revisar los componentes ya disponibles en `components/ui/` o su ubicación equivalente.
3. Reutilizar los componentes existentes.
4. Si shadcn/ui ofrece el componente necesario pero todavía no está instalado, agregarlo utilizando la configuración existente del proyecto.
5. Adaptar su apariencia utilizando los tokens definidos por este Design System.

No reemplazar una primitiva shadcn/ui disponible por una implementación manual con HTML + Tailwind salvo que exista una necesidad funcional concreta y documentada.

### Componentes que deben basarse en shadcn/ui cuando corresponda

```text
Button
Input
Textarea
Select
Badge
Card
Table
Dialog
DropdownMenu
Popover
Tooltip
Skeleton
Progress
Separator
Checkbox
RadioGroup
Form
Label
```

La lista no obliga a instalar componentes que la aplicación no necesite.

Instalar únicamente los componentes necesarios para las pantallas implementadas.

---

## 27.2. Componentes compartidos de aplicación

Los patrones propios de Solicitudes de Farmacia deben construirse componiendo primitivas shadcn/ui.

Ejemplos:

```text
shadcn Badge
    ↓
StatusBadge

shadcn Card
    ↓
MetricCard

shadcn Table
    ↓
SolicitudTable / ProductTable

shadcn Skeleton
    ↓
DashboardSkeleton

shadcn Progress
    ↓
DeliveryProgress
```

Otros patrones propios de la aplicación pueden existir directamente como componentes compartidos:

```text
PageHeader
EmptyState
Sidebar
SidebarItem
ApplicationShell
```

Estos componentes deben utilizar primitivas shadcn/ui cuando exista una primitiva apropiada dentro de su composición.

---

## 27.3. Componentes específicos de feature

Los componentes específicos de una funcionalidad pueden vivir dentro de su feature cuando no representan un patrón global.

Ejemplos conceptuales:

```text
SolicitudFilters
SolicitudSummary
SolicitudProductsTable
NewSolicitudProductSelector
NewSolicitudReview
```

No mover automáticamente todos los componentes a `components/shared`.

Un componente debe convertirse en compartido cuando exista un patrón reutilizable real.

---

## 27.4. Regla de decisión

Antes de crear cualquier componente nuevo comprobar, en este orden:

```text
1. ¿Ya existe en el proyecto?
            ↓ no
2. ¿Existe una primitiva shadcn/ui apropiada?
            ↓ no
3. ¿Existe un componente compartido que pueda extenderse?
            ↓ no
4. ¿Es un patrón reutilizable de la aplicación?
            ↓ no
5. Crear componente específico de feature.
```

No crear un componente nuevo antes de realizar estas comprobaciones.

---

## 27.5. Componentes prohibidos por duplicación

No crear componentes como:

```text
CustomButton
AppButton
StyledButton
CustomInput
StyledInput
CustomSelect
GenericCard
CustomBadge
```

si únicamente envuelven o duplican una primitiva shadcn/ui sin aportar comportamiento o semántica reutilizable.

Ejemplo incorrecto:

```tsx
function AppButton(props) {
  return <Button {...props} />;
}
```

Utilizar directamente `Button`.

Un wrapper está justificado únicamente cuando encapsula un patrón real de la aplicación.

---

## 27.6. Variantes

Las variantes visuales reutilizables deben definirse centralmente.

No repetir variantes mediante clases Tailwind dentro de cada página.

Ejemplo:

```tsx
<StatusBadge status="pending" />
```

en lugar de:

```tsx
<Badge className="bg-warning-muted text-warning">Pendiente</Badge>
```

repetido en distintas pantallas.

La traducción:

```text
pending   → warning
partial   → info
completed → success
closed    → neutral
```

debe existir en un único lugar.

---

## 27.7. Styling de shadcn/ui

Los componentes shadcn/ui deben adaptarse a este Design System mediante los tokens Tailwind definidos en este documento.

No utilizar los colores visuales por defecto de shadcn/ui cuando contradigan la identidad Funes Digital.

No utilizar:

```tsx
bg-green-700
text-slate-500
border-gray-200
bg-[#075A36]
```

cuando exista un token equivalente.

Utilizar:

```tsx
bg - primary - 600;
text - foreground - secondary;
border - border;
bg - surface;
```

Las primitivas shadcn/ui deben formar parte del mismo sistema visual que el resto de la aplicación.

---

## 27.8. Estructura orientativa

La estructura exacta debe respetar primero las convenciones existentes del repositorio.

Conceptualmente se espera una separación equivalente a:

```text
src/
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── progress.tsx
│   │   └── skeleton.tsx
│   │
│   ├── layout/
│   │   ├── application-shell.tsx
│   │   ├── sidebar.tsx
│   │   └── page-header.tsx
│   │
│   └── shared/
│       ├── status-badge.tsx
│       ├── metric-card.tsx
│       └── empty-state.tsx
│
└── app/
```

Esta estructura es orientativa.

No reorganizar un proyecto existente únicamente para replicarla.

La arquitectura existente tiene prioridad mientras permita mantener correctamente la separación entre:

```text
primitivas UI
componentes compartidos
componentes de feature
páginas
```

---

## 27.9. Reglas estrictas de reutilización

- No duplicar markup y estilos entre pantallas.
- No crear primitivas alternativas a shadcn/ui sin justificación.
- No crear wrappers triviales.
- No abstraer prematuramente componentes utilizados una única vez sin un patrón claro.
- No introducir una segunda librería de componentes.
- No modificar globalmente una primitiva shadcn para resolver un caso exclusivo de una pantalla.
- No introducir reglas de negocio dentro de primitivas UI.
- Los componentes compartidos deben mantener APIs claras y limitadas.
- Las páginas deben priorizar composición sobre grandes bloques de markup repetido.

# 28. Tailwind rules

Tailwind debe ser la herramienta principal para styling.

## Permitido

```tsx
className = "rounded-lg border border-border bg-surface p-6";
```

```tsx
className = "bg-primary-600 text-white hover:bg-primary-700";
```

```tsx
className = "bg-page text-foreground";
```

## Evitar

CSS custom cuando existe equivalencia directa:

```css
.card {
  padding: 24px;
  border-radius: 12px;
}
```

si puede representarse con Tailwind.

## Prohibido

```tsx
className = "bg-[#075A36]";
```

```tsx
className = "bg-green-800";
```

```tsx
style={{ color: "#307A52" }}
```

cuando existe un token equivalente.

Preferir:

```tsx
className = "bg-primary-600";
```

La regla general es:

> Si existe un token o utilidad Tailwind equivalente, utilizarla.

---

# 29. Identidad institucional

La identidad de Funes Digital debe percibirse de manera consistente sin dominar toda la interfaz.

## Alta presencia institucional

Utilizar verde institucional en:

```text
Sidebar
Botón principal
Links principales
Focus states
Progress
Iconografía destacada
Estado activo de navegación
```

## Presencia institucional suave

Utilizar verdes claros en:

```text
Fondos de iconos
Hover states
Empty states
Secciones destacadas
Cards institucionales
Acentos
```

## Mantener neutro

Mantener predominantemente blanco o gris verdoso:

```text
Área principal
Cards
Formularios
Tablas
Modales
Contenedores
```

## Colores semánticos independientes

```text
Pendiente       → warning
Entrega parcial → info
Completada      → success
Cerrada         → neutral
Error           → danger
```

No forzar estos estados a verde institucional si eso reduce su diferenciación.

---

# 30. Referencias visuales

Los mockups representan el objetivo de:

- estructura;
- jerarquía;
- distribución;
- proporciones;
- densidad;
- spacing;
- agrupación;
- relación entre sidebar y contenido;
- jerarquía de acciones;
- uso de cards;
- tablas;
- estados.

Los mockups existentes pueden contener una identidad azul anterior.

**No replicar los colores azules de los PNG.**

Cuando un mockup utilice:

```text
azul oscuro de navegación
azul de acciones
azul de selección
azul de acento
```

debe reinterpretarse mediante el token institucional equivalente definido en este documento.

Ejemplo conceptual:

```text
Acción azul del mockup       → primary-600
Hover azul                   → primary-700
Sidebar azul oscuro          → sidebar
Selección azul               → sidebar-active / primary-600
Acento azul claro            → primary-100
Fondo azulado                → page
```

No modificar por este motivo:

- layout;
- jerarquía;
- spacing;
- contenido;
- flujo;
- ubicación de componentes.

El cambio corresponde exclusivamente a identidad visual.

---

# 31. Criterios de aceptación

Una pantalla cumple el Design System cuando:

- utiliza los tokens definidos;
- utiliza la identidad Funes Digital;
- no replica la antigua identidad azul de los mockups;
- no contiene colores hardcodeados;
- no utiliza colores Tailwind genéricos cuando existe un token equivalente;
- utiliza Tailwind cuando existe una utilidad equivalente;
- reutiliza los componentes compartidos;
- respeta la jerarquía tipográfica;
- utiliza la escala de spacing definida;
- mantiene radius consistentes;
- utiliza correctamente los estados semánticos;
- mantiene sidebar y application shell consistentes;
- contempla loading, empty y error cuando corresponda;
- no introduce nuevas variantes visuales innecesarias;
- conserva la composición y jerarquía del mockup correspondiente;
- aplica la nueva identidad sin alterar comportamiento funcional.

La compilación exitosa no es suficiente para considerar terminada una pantalla.

Cuando sea posible, la implementación debe ejecutarse y compararse visualmente con el mockup de referencia antes de finalizar.

La comparación visual debe evaluar por separado:

1. estructura;
2. dimensiones;
3. spacing;
4. jerarquía tipográfica;
5. componentes;
6. identidad Funes Digital.

Una diferencia de color respecto de los PNG **no constituye un error** cuando el color implementado corresponde al token definido por este Design System.
