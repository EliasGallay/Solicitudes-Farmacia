'use client'

import type { MouseEvent } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'

export function ConfirmSubmit({ message, children, ...props }: ButtonProps & { message: string }) {
  function handleSubmit(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(message)) event.preventDefault()
  }

  return <Button type="submit" onClick={handleSubmit} variant="ghost" {...props}>{children}</Button>
}
