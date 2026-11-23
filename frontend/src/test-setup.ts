import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

// jsdom lacks a few browser APIs that Radix and cmdk use.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= function () {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= function () {}
Element.prototype.releasePointerCapture ??= function () {}
