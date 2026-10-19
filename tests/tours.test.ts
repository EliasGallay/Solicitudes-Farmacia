import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { screenTourFor, screenTours, screenTourSeenKey, stepHtml } from '../src/lib/tours'

// Todo el código fuente de la app, para buscar los data-tour que señalan los recorridos.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}
const source = sourceFiles(join(__dirname, '../src')).filter((path) => !path.endsWith('tours.ts')).map((path) => readFileSync(path, 'utf8')).join('\n')

const ID = '0b6a2f3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'

describe('recorridos por pantalla', () => {
  it.each(screenTours.flatMap((tour) => tour.steps.map((step) => [tour.id, step.target])))('%s: el elemento "%s" existe en el código', (_, target) => {
    // Como atributo literal o como valor de un ítem (p. ej. `tour: '...'` en la navegación).
    expect(source.includes(`data-tour="${target}"`) || source.includes(`'${target}'`)).toBe(true)
  })

  it('ids únicos y como máximo 6 pasos', () => {
    expect(new Set(screenTours.map((tour) => tour.id)).size).toBe(screenTours.length)
    for (const tour of screenTours) expect(tour.steps.length).toBeLessThanOrEqual(6)
  })

  it('elige el recorrido según la pantalla y el rol', () => {
    expect(screenTourFor('/', 'requester')?.id).toBe('inicio-solicitante')
    expect(screenTourFor('/solicitudes', 'requester')?.id).toBe('solicitudes-solicitante')
    expect(screenTourFor(`/solicitudes/${ID}`, 'requester')?.id).toBe('detalle-solicitante')
    expect(screenTourFor(`/solicitudes/${ID}/recibir`, 'requester')?.id).toBe('recibir-solicitante')
    expect(screenTourFor('/solicitudes/nueva', 'requester')).toBeUndefined()
    expect(screenTourFor('/', 'admin')).toBeUndefined()
    expect(screenTourFor('/', null)).toBeUndefined()
  })

  it('la clave de visto cambia con la versión', () => {
    expect(screenTourSeenKey({ id: 'inicio-solicitante', version: 1 })).not.toBe(screenTourSeenKey({ id: 'inicio-solicitante', version: 2 }))
  })

  it('arma la descripción con la lista opcional', () => {
    expect(stepHtml({ description: 'Hola' })).toBe('<p>Hola</p>')
    expect(stepHtml({ description: 'Hola', items: ['a', 'b'] })).toBe('<p>Hola</p><ul class="tour-list"><li>a</li><li>b</li></ul>')
  })
})
