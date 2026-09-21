export function openQuantity(requested: number, delivered: number, closed: number): number {
  if (![requested, delivered, closed].every(Number.isSafeInteger) || requested <= 0 || delivered < 0 || closed < 0 || delivered + closed > requested) {
    throw new Error('Cantidades inválidas')
  }
  return requested - delivered - closed
}
