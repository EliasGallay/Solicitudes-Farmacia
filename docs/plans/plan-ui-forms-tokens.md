# Plan de modernización UI y formularios

## Objetivo

Unificar la interfaz de Solicitudes de Farmacia mediante tokens de diseño, shadcn/ui, React Hook Form y Zod, manteniendo las Server Actions, la validación server-side y las reglas de seguridad de Supabase.

## Alcance

- Reemplazar colores hardcodeados por tokens semánticos.
- Instalar y configurar shadcn/ui sobre Next.js, Tailwind CSS 4 y TypeScript.
- Migrar progresivamente los formularios existentes.
- Crear componentes reutilizables para errores, estados pendientes, confirmaciones y mensajes de resultado.
- Mantener validación duplicada: experiencia inmediata en cliente y validación obligatoria en servidor.

## Decisiones técnicas

- UI: shadcn/ui y componentes propios basados en Tailwind.
- Estado de formularios: React Hook Form.
- Validación: Zod y `@hookform/resolvers`.
- Mutaciones: conservar Server Actions y sus validaciones actuales.
- Diseño: tokens semánticos CSS, no colores directos como `bg-slate-900`, `text-red-700` o `border-slate-200` dentro de las páginas.
- Accesibilidad: labels asociados, mensajes de error con `aria-describedby`, foco visible y estados disabled durante el submit.
- Migración gradual: cada módulo debe quedar funcional antes de avanzar al siguiente.

## Fase 0 — Inventario y criterios visuales

### Tareas

- [x] Inventariar colores, bordes, sombras, radios, tipografías y tamaños repetidos.
- [x] Identificar todas las clases de color hardcodeadas en `src/`.
- [x] Definir escala semántica para fondo, superficie, texto, texto secundario, borde, acción, foco, éxito, advertencia y error.
- [x] Definir estados visuales para hover, focus, disabled, loading y destructive.
- [x] Documentar reglas de uso de tokens.

### Criterio de finalización

Existe una tabla de tokens aprobada y cada color actual tiene una correspondencia semántica definida.

## Fase 1 — Tokens de diseño

### Tareas

- [x] Crear tokens CSS globales en `src/app/globals.css` usando variables HSL compatibles con shadcn.
- [ ] Definir tokens para modo claro y dejar preparada la estructura para modo oscuro futuro.
- [ ] Mapear los tokens a la configuración de Tailwind/shadcn.
- [x] Reemplazar colores directos de `AppShell`, páginas, formularios y estados.
- [ ] Reemplazar sombras, radios y colores de foco repetidos por tokens o utilidades consistentes.
- [ ] Verificar contraste mínimo de textos y controles.

### Criterio de finalización

Las páginas no utilizan colores hexadecimales ni clases de color de la paleta directamente para decisiones semánticas; los cambios de color se pueden hacer desde los tokens globales.

## Fase 2 — Instalación y configuración de shadcn/ui

### Tareas

- [x] Instalar las dependencias necesarias para componentes y formularios.
- [x] Configurar `components.json`, alias de imports y directorio `src/components/ui`.
- [ ] Verificar compatibilidad con Tailwind CSS 4 y el postcss actual.
- [x] Incorporar componentes base usados: `Button`, `Input`, `Label`, `Form` y `Alert`.
- [ ] Ajustar los componentes base para usar los tokens semánticos del proyecto.
- [ ] Crear una pantalla o sección de referencia visual para revisar estados y consistencia.

### Criterio de finalización

shadcn/ui está configurado, los componentes base compilan y respetan los tokens sin duplicar estilos en cada página.

## Fase 3 — Infraestructura de formularios

### Tareas

- [x] Instalar `react-hook-form` y `@hookform/resolvers`.
- [x] Definir el patrón estándar `useForm` + `zodResolver` + Server Action.
- [ ] Separar schemas Zod compartidos de las acciones cuando sea conveniente.
- [ ] Definir cómo se serializan formularios hacia `FormData` y/o objetos para Server Actions.
- [x] Crear manejo común de errores de campo y errores generales de Supabase.
- [x] Crear estado pending con `useTransition` para cada formulario cliente.
- [ ] Mantener validación obligatoria en Server Actions aunque exista validación cliente.

### Criterio de finalización

Existe un ejemplo completo de formulario con validación, error de campo, error general, pending, éxito y accesibilidad.

## Fase 4 — Migrar CRUD de productos

### Tareas

- [x] Convertir alta de producto a React Hook Form + Zod + componentes shadcn.
- [x] Convertir edición de producto al mismo patrón.
- [ ] Crear feedback reutilizable para producto creado, actualizado o rechazado.
- [x] Agregar estado pending y evitar doble submit.
- [ ] Mostrar errores de nombre, presentación y duplicados junto al campo correspondiente.
- [ ] Mantener el control de rol administrador en Server Actions y RLS.
- [ ] Mantener desactivación/reactivación como eliminación lógica.
- [x] Agregar confirmación antes de desactivar un producto.
- [ ] Probar productos activos, inactivos, duplicados y errores de permisos.

### Criterio de finalización

Un administrador puede crear, editar, desactivar y reactivar productos con feedback claro y sin perder protección server-side.

## Fase 5 — Migrar nueva solicitud

### Tareas

- [x] Convertir selección de centro a componente controlado por React Hook Form.
- [x] Convertir cantidades a campos controlados por React Hook Form.
- [x] Mantener cantidades enteras positivas y rechazo de valores inválidos.
- [ ] Mostrar productos activos con presentación y estado de cada campo.
- [x] Agregar resumen previo de productos seleccionados.
- [x] Mostrar errores por producto y error general de la RPC.
- [x] Agregar estado pending y bloqueo de submit mientras se procesa.
- [ ] Mostrar confirmación de creación y enlace al historial.
- [ ] Mantener la transacción RPC y las validaciones RLS existentes.

### Criterio de finalización

Un usuario autorizado puede crear una solicitud con una experiencia validada y accesible, sin sobreentregas ni datos inválidos.

## Fase 6 — Migrar login y cambio de contraseña

### Tareas

- [x] Migrar login a React Hook Form + Zod + componentes shadcn.
- [ ] Mostrar errores de credenciales sin filtrar información sensible.
- [x] Agregar estado pending y evitar múltiples intentos simultáneos.
- [x] Migrar cambio de contraseña con validación de longitud, coincidencia y reglas de Supabase.
- [ ] Mostrar el error real de Auth de forma segura y legible.
- [ ] Agregar indicador de requisitos de contraseña.
- [ ] Mantener logout y redirecciones actuales.
- [ ] Verificar sesión expirada, usuario inactivo y primer acceso obligatorio.

### Criterio de finalización

Login, logout y cambio obligatorio de contraseña funcionan con feedback claro, sin exponer secretos ni romper el flujo SSR.

## Fase 7 — Componentes reutilizables de estado

### Tareas

- [x] Crear `FormField`/`FieldError` para errores asociados a controles.
- [x] Crear `FormError` para errores generales del servidor.
- [x] Crear `SubmitButton` con estado pending y texto configurable.
- [x] Crear `SuccessMessage` para confirmaciones no bloqueantes.
- [x] Crear confirmación reutilizable para acciones destructivas.
- [x] Crear `EmptyState` para listas sin registros.
- [ ] Crear `LoadingState`/`Skeleton` para cargas de módulos.
- [ ] Definir mensajes y tono consistentes en español.
- [ ] Verificar navegación por teclado y lectores de pantalla.

### Criterio de finalización

Los módulos no duplican lógica de estados, errores o confirmaciones y todos los componentes tienen comportamiento consistente.

## Fase 8 — Limpieza y verificación

### Tareas

- [x] Buscar y eliminar colores hardcodeados restantes en `src/`.
- [ ] Revisar que no se haya movido lógica de autorización únicamente al cliente.
- [x] Ejecutar `typecheck`, lint, tests y build.
- [ ] Agregar tests para schemas y transformaciones de formularios.
- [ ] Probar responsive en desktop, tablet y mobile.
- [ ] Probar estados loading, error, éxito, vacío y permisos insuficientes.
- [ ] Actualizar README con instalación y convenciones de UI.

### Criterio de finalización

La interfaz usa tokens, los formularios comparten una arquitectura única, las rutas críticas pasan las validaciones y el proyecto queda listo para continuar con entregas y auditoría.

## Orden recomendado

1. Inventario visual y tokens.
2. Configuración de shadcn/ui.
3. Infraestructura de React Hook Form y estados.
4. CRUD de productos.
5. Nueva solicitud.
6. Login y cambio de contraseña.
7. Limpieza, accesibilidad y validación.

## Riesgos y controles

- **Riesgo:** convertir demasiados componentes en Client Components.
  - **Control:** mantener lectura, autorización y mutaciones en servidor; usar cliente solo para interacción del formulario.
- **Riesgo:** confiar en validación cliente.
  - **Control:** conservar Zod y autorización en Server Actions/RLS.
- **Riesgo:** borrar productos con historial.
  - **Control:** usar desactivación lógica.
- **Riesgo:** introducir estilos duplicados.
  - **Control:** revisar tokens y componentes base antes de migrar cada módulo.
