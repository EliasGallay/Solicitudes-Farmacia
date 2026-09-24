const hourFormat = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hourCycle: 'h23' })

// Buenos días 6–12, Buenas tardes 12–20, Buenas noches el resto (hora de Argentina).
export function greeting(date: Date = new Date()) {
  const hour = Number(hourFormat.format(date))
  if (hour >= 6 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
