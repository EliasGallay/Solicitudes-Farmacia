'use client'

import { useEffect } from 'react'
import { driver } from 'driver.js'
import { usePathname } from 'next/navigation'
import 'driver.js/dist/driver.css'
import type { AppRole } from '@/lib/session'

const TOUR_SEEN_KEY = 'solicitudes-insumos:tour-v1-seen'
const WORKFLOW_KEY = 'solicitudes-insumos:workflow-requester'

type Tour = { destroy: () => void; drive: () => void }

// ProductTour y WorkflowTour se montan dos veces (sidebar de desktop y menú mobile, que se renderiza
// aunque esté oculto). Cada driver() agrega su propio cartel al body: con dos instancias, al cerrar
// una la otra queda visible para siempre. Por eso el estado es del módulo y hay un solo tour activo.
let productTour: Tour | undefined
let autoStartDone = false
let workflowTour: Tour | undefined
let workflowSignature = ''

function visibleElement(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
    const styles = window.getComputedStyle(element)
    return styles.display !== 'none' && styles.visibility !== 'hidden' && element.getClientRects().length > 0
  })
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

  if (steps.length === 0) return

  productTour?.destroy()
  productTour = driver({
    showProgress: true,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Listo',
    overlayColor: 'var(--color-foreground)',
    overlayOpacity: 0.55,
    steps,
    onDestroyed: () => { productTour = undefined },
  })
  productTour.drive()
}

export function ProductTour({ role }: { role: AppRole | null }) {
  useEffect(() => {
    if (autoStartDone || window.localStorage.getItem(TOUR_SEEN_KEY)) return

    // Las dos instancias programan el arranque; solo la primera lo ejecuta.
    const frame = window.requestAnimationFrame(() => {
      if (autoStartDone) return
      autoStartDone = true
      window.localStorage.setItem(TOUR_SEEN_KEY, 'true')
      startProductTour(role)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [role])

  return (
    <button
      type="button"
      onClick={() => startProductTour(role)}
      className="flex h-11 w-full shrink-0 items-center gap-3 rounded-md px-4 text-base text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      <span aria-hidden>?</span>
      Ver tutorial
    </button>
  )
}

function workflowSteps(pathname: string) {
  if (pathname === '/solicitudes/nueva' && document.querySelector('[data-workflow="products"]')) {
    return [
      { element: '[data-workflow="stepper"]', popover: { title: 'Paso 1: elegir productos', description: 'El indicador superior muestra en qué parte de la solicitud estás.' } },
      { element: '[data-workflow="search"]', popover: { title: 'Buscá lo que necesitás', description: 'Podés buscar por nombre y filtrar por tipo de producto.' } },
      { element: '[data-workflow="products"]', popover: { title: 'Agregá cantidades', description: 'Elegí los productos y definí cuántas unidades necesitás.' } },
      { element: '[data-workflow="next"]', popover: { title: 'Pasá a la revisión', description: 'Cuando termines de elegir, revisá la solicitud antes de enviarla.' } },
    ]
  }

  if (pathname === '/solicitudes/nueva' && document.querySelector('[data-workflow="review"]')) {
    return [
      { element: '[data-workflow="stepper"]', popover: { title: 'Paso 2: revisar', description: 'Acá podés verificar los productos y las cantidades seleccionadas.' } },
      { element: '[data-workflow="review"]', popover: { title: 'Revisá los datos', description: 'Antes de enviar, confirmá que todo esté correcto.' } },
      { element: '[data-workflow="observations"]', popover: { title: 'Agregá una observación', description: 'Este campo es opcional y sirve para dejar una aclaración.' } },
      { element: '[data-workflow="submit"]', popover: { title: 'Enviá la solicitud', description: 'Al confirmar, la solicitud queda registrada para su gestión.' } },
    ]
  }

  if (pathname === '/solicitudes/nueva' && document.querySelector('[data-workflow="sent"]')) {
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
  window.dispatchEvent(new Event('requester-workflow-start'))
}

export function WorkflowTour({ role }: { role: AppRole | null }) {
  const pathname = usePathname()

  useEffect(() => {
    if (role === 'admin') return

    const stop = () => {
      workflowTour?.destroy()
      workflowTour = undefined
      workflowSignature = ''
    }

    const show = () => {
      if (!window.sessionStorage.getItem(WORKFLOW_KEY)) return
      const steps = workflowSteps(pathname)
      if (steps.length === 0) return
      const signature = steps.map((step) => step.element).join('|')
      // La firma es del módulo: la otra instancia no vuelve a crear el mismo tour.
      if (signature === workflowSignature) return
      stop()
      workflowSignature = signature
      workflowTour = driver({
        showProgress: true,
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Listo',
        overlayColor: 'var(--color-foreground)',
        overlayOpacity: 0.55,
        steps,
        onCloseClick: () => {
          window.sessionStorage.removeItem(WORKFLOW_KEY)
          stop()
        },
        onDoneClick: () => {
          window.sessionStorage.removeItem(WORKFLOW_KEY)
          stop()
        },
      })
      workflowTour.drive()
    }

    const frame = window.requestAnimationFrame(show)
    const observer = new MutationObserver(show)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('requester-workflow-start', show)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('requester-workflow-start', show)
      stop()
    }
  }, [pathname, role])

  if (role === 'admin') return null

  return (
    <button
      type="button"
      onClick={startRequesterWorkflow}
      className="flex h-11 w-full shrink-0 items-center gap-3 rounded-md px-4 text-base text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      <span aria-hidden>→</span>
      Aprender a hacer una solicitud
    </button>
  )
}
