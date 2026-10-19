'use client'

import { useEffect } from 'react'
import { driver, type Config, type DriveStep, type PopoverDOM } from 'driver.js'
import { usePathname } from 'next/navigation'
import { CircleHelp, Route } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'driver.js/dist/driver.css'
import type { AppRole } from '@/lib/session'
import { screenTourFor, screenTourSeenKey, stepHtml, type ScreenTour } from '@/lib/tours'

const TOUR_SEEN_KEY = 'solicitudes-insumos:tour-v1-seen'
const WORKFLOW_KEY = 'solicitudes-insumos:workflow-requester'
const WORKFLOW_START_EVENT = 'requester-workflow-start'
// "No mostrar más": apaga el arranque automático de los recorridos por pantalla (el botón de ayuda sigue).
const SCREEN_TOURS_OFF_KEY = 'solicitudes-insumos:tours-auto-off'
// Un tour terminó porque lo cerró el usuario: el recorrido de la pantalla puede arrancar si esperaba.
const TOUR_IDLE_EVENT = 'tour-idle'
// Tiempo máximo esperando que la pantalla cargue (Suspense) antes de desistir del arranque automático.
const SCREEN_TOUR_WAIT_MS = 10_000

type Tour = ReturnType<typeof driver>

// localStorage/sessionStorage pueden fallar (navegación privada, almacenamiento bloqueado).
function readStorage(storage: 'local' | 'session', key: string) {
  try {
    return (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string) {
  try {
    window.localStorage.setItem(key, 'true')
  } catch {
    // Sin almacenamiento el recorrido automático puede repetirse; no es un error.
  }
}

// Un solo tour activo en toda la app. Los botones se renderizan dos veces (sidebar de desktop y menú
// mobile) pero solo disparan; el arranque automático y el seguimiento del recorrido guiado viven en
// TourController, que se monta una única vez en el shell.
let activeTour: Tour | undefined
let workflowSignature = ''

function visibleElement(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
    const styles = window.getComputedStyle(element)
    return styles.display !== 'none' && styles.visibility !== 'hidden' && element.getClientRects().length > 0
  })
}

// El menú de "Sistema y tutoriales" queda abierto al elegir una opción, y en mobile el drawer es un
// <dialog> modal: está en la top layer, por encima del overlay del tour. Se cierran antes de empezar.
function closeMenus() {
  document.querySelectorAll('details[open]').forEach((details) => details.removeAttribute('open'))
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close())
}

function stopTour() {
  const tour = activeTour
  activeTour = undefined
  workflowSignature = ''
  tour?.destroy()
}

// `onRender`: agregados al cartel de cada paso (p. ej. "No mostrar más").
function startTour(steps: DriveStep[], options: Partial<Config> = {}, onRender?: (popover: PopoverDOM) => void) {
  stopTour()
  closeMenus()
  const tour = driver({
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Listo',
    overlayColor: 'var(--color-foreground)',
    overlayOpacity: 0.55,
    steps,
    // Solo se ve el cartel del paso activo: si quedó alguno de un paso o tour anterior, se quita.
    onPopoverRender: (popover) => {
      document.querySelectorAll('.driver-popover').forEach((element) => { if (element !== popover.wrapper) element.remove() })
      onRender?.(popover)
    },
    // Si lo cerró el usuario (no lo reemplazó otro tour), se avisa que no hay tour activo.
    onDestroyed: () => {
      if (activeTour !== tour) return
      activeTour = undefined
      workflowSignature = ''
      window.dispatchEvent(new Event(TOUR_IDLE_EVENT))
    },
    ...options,
  })
  activeTour = tour
  tour.drive()
}

const tourSelector = (target: string) => `[data-tour="${target}"]`

// Recorrido de una pantalla con los pasos cuyo elemento está visible. `auto`: arrancado solo (primera
// visita), con la opción de no mostrar más los automáticos. Devuelve false si no había nada para mostrar.
function startScreenTour(tour: ScreenTour, auto = false) {
  const steps = tour.steps.flatMap((step): DriveStep[] => {
    const element = visibleElement(tourSelector(step.target))
    return element ? [{ element, popover: { title: step.title, description: stepHtml(step) } }] : []
  })
  if (steps.length === 0) return false
  startTour(steps, {}, auto ? (popover) => {
    const optOut = document.createElement('button')
    optOut.type = 'button'
    optOut.className = 'tour-opt-out'
    optOut.textContent = 'No mostrar más estos recorridos'
    optOut.addEventListener('click', () => {
      writeStorage(SCREEN_TOURS_OFF_KEY)
      stopTour()
    })
    popover.wrapper.insertBefore(optOut, popover.footer)
  } : undefined)
  return true
}

export function startProductTour(role: AppRole | null) {
  const steps = [
    {
      element: visibleElement('[data-tour="brand"]'),
      popover: { title: 'Solicitudes de Insumos', description: 'Desde acá podés volver al inicio en cualquier momento.' },
    },
    {
      element: visibleElement('[data-tour="navigation"]'),
      popover: {
        title: role === 'admin' ? 'Panel de administración' : 'Navegación principal',
        description: role === 'admin'
          ? 'Accedé a solicitudes, entregas, catálogos, usuarios y auditoría.'
          : 'Encontrá tus solicitudes, creá una nueva y consultá el catálogo disponible.',
      },
    },
    {
      element: visibleElement('[data-tour="main"]'),
      popover: { title: 'Tu espacio de trabajo', description: 'El contenido de cada sección aparece en esta parte de la pantalla.' },
    },
    {
      element: visibleElement('[data-tour="profile"]'),
      popover: { title: 'Tu cuenta', description: 'Desde acá podés revisar tu perfil, cambiar el tema o cerrar sesión.' },
    },
  ].filter((step) => step.element)

  if (steps.length > 0) startTour(steps)
}

function workflowSteps(pathname: string): DriveStep[] {
  if (pathname !== '/solicitudes/nueva') return []

  if (document.querySelector('[data-workflow="products"]')) {
    return [
      { element: '[data-workflow="stepper"]', popover: { title: 'Paso 1: elegir productos', description: 'El indicador superior muestra en qué parte de la solicitud estás.' } },
      { element: '[data-workflow="search"]', popover: { title: 'Buscá lo que necesitás', description: 'Podés buscar por nombre y filtrar por tipo de producto.' } },
      { element: '[data-workflow="products"]', popover: { title: 'Agregá cantidades', description: 'Elegí los productos y definí cuántas unidades necesitás.' } },
      { element: '[data-workflow="next"]', popover: { title: 'Pasá a la revisión', description: 'Cuando termines de elegir, revisá la solicitud antes de enviarla.' } },
    ]
  }

  if (document.querySelector('[data-workflow="review"]')) {
    return [
      { element: '[data-workflow="stepper"]', popover: { title: 'Paso 2: revisar', description: 'Acá podés verificar los productos y ajustar las cantidades.' } },
      { element: '[data-workflow="review"]', popover: { title: 'Revisá los datos', description: 'Antes de enviar, confirmá que todo esté correcto.' } },
      { element: '[data-workflow="observations"]', popover: { title: 'Agregá una observación', description: 'Este campo es opcional y sirve para dejar una aclaración.' } },
      { element: '[data-workflow="submit"]', popover: { title: 'Enviá la solicitud', description: 'Al confirmar, la solicitud queda registrada para su gestión.' } },
    ]
  }

  if (document.querySelector('[data-workflow="sent"]')) {
    return [
      { element: '[data-workflow="stepper"]', popover: { title: 'Paso 3: solicitud enviada', description: 'La solicitud ya fue registrada correctamente.' } },
      { element: '[data-workflow="sent"]', popover: { title: 'Guardá el número', description: 'Este número identifica tu solicitud y te permite seguir su estado.' } },
      { element: '[data-workflow="view-request"]', popover: { title: 'Consultá el detalle', description: 'Desde acá podés ver el estado, los productos y las entregas.' } },
    ]
  }

  return []
}

export function startRequesterWorkflow() {
  window.sessionStorage.setItem(WORKFLOW_KEY, 'true')
  if (window.location.pathname !== '/solicitudes/nueva') {
    window.location.assign('/solicitudes/nueva')
    return
  }
  window.dispatchEvent(new Event(WORKFLOW_START_EVENT))
}

// Arranque automático del tour general (primera visita) y recorrido guiado de la nueva solicitud,
// que acompaña al usuario por los pasos del asistente. Se monta una sola vez, en el shell.
export function TourController({ role }: { role: AppRole | null }) {
  const pathname = usePathname()

  useEffect(() => {
    if (readStorage('local', TOUR_SEEN_KEY)) return
    const frame = window.requestAnimationFrame(() => {
      writeStorage(TOUR_SEEN_KEY)
      startProductTour(role)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [role])

  // Recorrido de la pantalla: arranca solo la primera vez (por versión), cuando sus elementos ya
  // cargaron y no hay otro tour en curso. El tour general de la primera visita va antes: al cerrarlo
  // (TOUR_IDLE_EVENT) se vuelve a intentar.
  useEffect(() => {
    const tour = screenTourFor(pathname, role)
    if (!tour) return

    const allowed = () => readStorage('local', TOUR_SEEN_KEY) && !readStorage('local', SCREEN_TOURS_OFF_KEY) && !readStorage('local', screenTourSeenKey(tour)) && !readStorage('session', WORKFLOW_KEY)
    const ready = () => tour.steps.every((step) => step.optional || visibleElement(tourSelector(step.target)))

    let frame = 0
    const tryStart = () => {
      if (!allowed()) return stopWaiting()
      if (activeTour?.isActive() || !ready()) return
      stopWaiting()
      if (startScreenTour(tour, true)) writeStorage(screenTourSeenKey(tour))
    }
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(tryStart)
    }
    const observer = new MutationObserver(schedule)
    const timeout = window.setTimeout(() => observer.disconnect(), SCREEN_TOUR_WAIT_MS)
    function stopWaiting() {
      observer.disconnect()
      window.clearTimeout(timeout)
      window.removeEventListener(TOUR_IDLE_EVENT, schedule)
    }

    observer.observe(document.querySelector(tourSelector('main')) ?? document.body, { childList: true, subtree: true })
    window.addEventListener(TOUR_IDLE_EVENT, schedule)
    schedule()

    return () => {
      window.cancelAnimationFrame(frame)
      stopWaiting()
    }
  }, [pathname, role])

  useEffect(() => {
    if (role === 'admin') return

    const show = () => {
      if (!window.sessionStorage.getItem(WORKFLOW_KEY)) return
      const steps = workflowSteps(pathname)
      if (steps.length === 0) return
      const signature = steps.map((step) => step.element).join('|')
      // Mismo paso del asistente: el tour ya está en pantalla.
      if (signature === workflowSignature && activeTour?.isActive()) return
      startTour(steps, {
        // Cerrarlo el usuario (Listo, la cruz, Esc o clic afuera) termina el recorrido guiado. Cuando
        // el asistente cambia de paso, el tour se reemplaza con destroy(), que no pasa por acá.
        onDestroyStarted: () => {
          window.sessionStorage.removeItem(WORKFLOW_KEY)
          stopTour()
        },
      })
      workflowSignature = signature
    }

    // Las mutaciones del propio tour también disparan el observer: se agrupan en un frame.
    let frame = window.requestAnimationFrame(show)
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(show)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.querySelector('[data-tour="main"]') ?? document.body, { childList: true, subtree: true })
    window.addEventListener(WORKFLOW_START_EVENT, show)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener(WORKFLOW_START_EVENT, show)
      // Al cambiar de pantalla se cierra el tour sin terminar el recorrido (sigue en la próxima).
      if (workflowSignature) stopTour()
    }
  }, [pathname, role])

  return null
}

const tourButtonClasses = 'flex h-11 w-full shrink-0 items-center gap-3 text-left [&_svg]:size-5 [&_svg]:shrink-0 rounded-md px-4 text-base text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400'

export function ProductTour({ role, className }: { role: AppRole | null; className?: string }) {
  return (
    <button type="button" onClick={() => startProductTour(role)} className={cn(tourButtonClasses, className)}>
      <CircleHelp aria-hidden />
      Ver tutorial
    </button>
  )
}

// "¿Cómo funciona esta pantalla?": junto a la campana, solo en pantallas con recorrido para el rol.
export function ScreenHelpButton({ role, className }: { role: AppRole | null; className?: string }) {
  const pathname = usePathname()
  const tour = screenTourFor(pathname, role)
  if (!tour) return null
  return (
    <button
      type="button"
      onClick={() => startScreenTour(tour)}
      aria-label="Cómo funciona esta pantalla"
      title="Cómo funciona esta pantalla"
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400', className)}
    >
      <CircleHelp className="size-6" aria-hidden />
    </button>
  )
}

export function WorkflowTour({ role, className }: { role: AppRole | null; className?: string }) {
  if (role === 'admin') return null
  return (
    <button type="button" onClick={startRequesterWorkflow} className={cn(tourButtonClasses, className)}>
      <Route aria-hidden />
      Cómo hacer una solicitud
    </button>
  )
}
