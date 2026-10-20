// Utilidades de los gráficos del panel (src/components/dashboard).

// Escala "redonda" para un eje que arranca en 0: máximo y marcas en pasos de 1, 2 o 5 × 10^n.
export function niceScale(max: number, tickCount = 4) {
  if (max <= 0) return { max: tickCount, ticks: Array.from({ length: tickCount + 1 }, (_, index) => index) }
  const rough = max / tickCount
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ?? 10 * magnitude
  const niceMax = Math.ceil(max / step) * step
  return { max: niceMax, ticks: Array.from({ length: Math.round(niceMax / step) + 1 }, (_, index) => index * step) }
}

// Índices de las etiquetas del eje X: hasta `max`, repartidas e incluyendo la primera y la última.
export function axisLabelIndexes(length: number, max: number) {
  if (length <= max) return Array.from({ length }, (_, index) => index)
  const step = (length - 1) / (max - 1)
  return Array.from({ length: max }, (_, index) => Math.round(index * step))
}

// Números compactos para ejes y valores: 950, 1,2 mil, 12 mil.
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('es-AR')

export function formatCount(value: number) {
  return value >= 1000 ? compact.format(value) : plain.format(value)
}
