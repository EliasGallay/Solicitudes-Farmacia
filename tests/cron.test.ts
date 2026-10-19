import { describe, expect, it } from 'vitest'
import { isAuthorizedCron } from '../src/lib/cron'

describe('isAuthorizedCron', () => {
  it('acepta el header de Vercel Cron con el secreto correcto', () => expect(isAuthorizedCron('Bearer s3cr3t', 's3cr3t')).toBe(true))
  it('rechaza un secreto distinto o mal formado', () => {
    expect(isAuthorizedCron('Bearer otro', 's3cr3t')).toBe(false)
    expect(isAuthorizedCron('s3cr3t', 's3cr3t')).toBe(false)
  })
  it('rechaza todo si falta el header o el secreto', () => {
    expect(isAuthorizedCron(null, 's3cr3t')).toBe(false)
    expect(isAuthorizedCron('Bearer ', '')).toBe(false)
    expect(isAuthorizedCron('Bearer undefined', undefined)).toBe(false)
  })
})
