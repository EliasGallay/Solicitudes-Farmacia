// Interpretación de la planilla "LAO salud" para el listado de revisión del script de importación
// (scripts/import-personal-planilla.ts). Nada de esto escribe en la base: solo clasifica las filas.
// Sin imports: el script lo corre Node con --experimental-strip-types, que exige rutas con extensión.

// Espacios colapsados y sin bordes: «  RIOS   LUCIA » → «RIOS LUCIA».
export function normalizeName(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export type PlanillaName = { lastName: string; firstName: string; ambiguous: boolean }

// La planilla escribe «APELLIDO NOMBRE» o «APELLIDO,NOMBRE». Con tres o más partes sin coma no se
// sabe dónde termina el apellido: se marca para revisión.
export function splitPlanillaName(raw: string): PlanillaName {
  if (raw.includes(',')) {
    const [last, ...rest] = raw.split(',').map((part) => normalizeName(part))
    return { lastName: last, firstName: rest.join(' '), ambiguous: rest.join(' ') === '' }
  }
  const tokens = normalizeName(raw).split(' ').filter(Boolean)
  if (tokens.length === 2) return { lastName: tokens[0], firstName: tokens[1], ambiguous: false }
  return { lastName: tokens[0] ?? '', firstName: tokens.slice(1).join(' '), ambiguous: true }
}

export type InterpretedLicense =
  | { kind: 'hours_permit'; startsOn: string; hours: number }
  | { kind: 'unparsed'; raw: string }

// Solo interpreta lo que tiene día, mes y horas, p. ej. «27/11 3HS» o «13/11 1,5HS». Rangos sin mes,
// reintegros y texto libre quedan como no interpretados para revisión manual.
export function interpretLicense(raw: string, year: number): InterpretedLicense {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\s+(1,5|3)\s*HS$/i)
  if (!match) return { kind: 'unparsed', raw }
  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  return { kind: 'hours_permit', startsOn: `${year}-${month}-${day}`, hours: Number(match[3].replace(',', '.')) }
}

// Personas repetidas (nombre normalizado sin mayúsculas ni espacios extra). Devuelve los grupos de
// más de una fila para que se revisen juntos.
export function findDuplicates(rows: { lastName: string; firstName: string }[]) {
  const groups = new Map<string, { lastName: string; firstName: string }[]>()
  for (const row of rows) {
    const key = normalizeName(`${row.lastName} ${row.firstName}`).toUpperCase()
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.values()].filter((group) => group.length > 1)
}
