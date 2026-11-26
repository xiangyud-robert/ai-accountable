import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { toast } from 'sonner'
import { afterAll, afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // Sonner keeps open toasts outside React and shows them to the next test's Toaster.
  toast.dismiss()
})
// Radix hands focus back on a timer once a dialog closes, which mustn't fire after jsdom is gone.
afterAll(() => new Promise((resolve) => setTimeout(resolve)))

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
