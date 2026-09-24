import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { hrefFor, navigate } from '../lib/router'
import type { Route } from '../lib/routes'

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: Route
  replace?: boolean
}

/** Enlace interno: href real (se puede abrir en otra pestaña) + navegación sin recargar. */
export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    navigate(to, { replace })
  }
  return (
    <a href={hrefFor(to)} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
