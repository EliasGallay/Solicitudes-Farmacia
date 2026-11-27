// Importación one-off de la planilla "LAO salud" (docs/plans/plan-gestion-personal.md, Tarea 6).
//
// Uso (Node 22.15 o superior):
//   node --experimental-strip-types scripts/import-personal-planilla.ts <planilla.csv> [--year 2026]
//
// Lee la hoja exportada a CSV desde Excel (Archivo > Guardar como > CSV) y genera
// scripts/out/revision-personal.csv con el estado de cada fila. NO escribe en la base.
//
// La carga a producción NO está implementada: requiere autorización explícita del usuario y decidir
// cómo se autentica el admin desde un script. Por eso --apply termina con error.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findDuplicates, interpretLicense, splitPlanillaName } from '../src/lib/staff-import.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'out')
const outFile = join(outDir, 'revision-personal.csv')

// Encabezados de sección de la planilla («FAUST MES», «CHOFERES», «SERENOS», ...): no son personas.
const SECTION = /\bMES\b|^(VACACIONES|HOUSSAY|CHOFERES|SERENOS|SECRETARIA DE SALUD|AIMET)/i

// Lector de CSV mínimo: separador ';' o ',' (según la primera línea) y campos entre comillas.
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const separator = firstLine.includes(';') ? ';' : ','
  const rows: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    if (line === '') continue
    const fields: string[] = []
    let current = ''
    let quoted = false
    for (let index = 0; index < line.length; index++) {
      const char = line[index]
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"'
          index++
        } else {
          quoted = !quoted
        }
      } else if (char === separator && !quoted) {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }
    fields.push(current)
    rows.push(fields)
  }
  return rows
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--apply')) {
    console.error('La carga a producción no está implementada. Ver docs/plans/plan-gestion-personal.md, Tarea 6, Step 5.')
    process.exit(1)
  }

  const file = args.find((arg) => !arg.startsWith('--'))
  if (!file) {
    console.error('Uso: node --experimental-strip-types scripts/import-personal-planilla.ts <planilla.csv> [--year 2026]')
    process.exit(1)
  }
  const yearIndex = args.indexOf('--year')
  const year = yearIndex >= 0 ? Number(args[yearIndex + 1]) : 2026

  // Columna A: nombre. Columna B: licencia. El resto (reintegros, cumpleaños) se revisa a mano.
  const rows = parseCsv(readFileSync(file, 'utf8'))
  const candidates = rows
    .map((fields, index) => ({ line: index + 1, raw: (fields[0] ?? '').trim(), license: (fields[1] ?? '').trim() }))
    .filter((row) => row.raw !== '')

  const people = candidates.filter((row) => !SECTION.test(row.raw))
  const parsed = people.map((row) => ({ ...row, name: splitPlanillaName(row.raw) }))
  const duplicates = findDuplicates(parsed.map((row) => row.name))
  const duplicateKeys = new Set(duplicates.flat().map((name) => `${name.lastName}|${name.firstName}`))

  const lines = [['fila', 'nombre_original', 'apellido', 'nombre', 'estado', 'licencia_original', 'licencia_tipo', 'fecha', 'horas'].join(',')]
  const counts: Record<string, number> = {}

  for (const row of candidates) {
    if (SECTION.test(row.raw)) {
      counts.seccion = (counts.seccion ?? 0) + 1
      lines.push([row.line, row.raw, '', '', 'seccion', row.license, '', '', ''].map(csvCell).join(','))
      continue
    }

    const person = parsed.find((item) => item.line === row.line)!
    const license = row.license ? interpretLicense(row.license, year) : null
    let state = 'ok'
    if (person.name.ambiguous) state = 'ambiguo'
    else if (duplicateKeys.has(`${person.name.lastName}|${person.name.firstName}`)) state = 'duplicado'
    else if (license?.kind === 'unparsed') state = 'licencia-no-interpretada'

    counts[state] = (counts[state] ?? 0) + 1
    lines.push([
      row.line,
      row.raw,
      person.name.lastName,
      person.name.firstName,
      state,
      row.license,
      license?.kind ?? '',
      license?.kind === 'hours_permit' ? license.startsOn : '',
      license?.kind === 'hours_permit' ? license.hours : '',
    ].map(csvCell).join(','))
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, `﻿${lines.join('\n')}\n`, 'utf8')

  console.log(`Listado de revisión: ${outFile}`)
  for (const [state, count] of Object.entries(counts)) console.log(`  ${state}: ${count}`)
  console.log('No se escribió nada en la base.')
}

main()
