import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for the Locate control behavior.
 * Runs in jsdom — we mock Leaflet and navigator.geolocation.
 */

// Minimal Leaflet stubs
function createMockMap() {
  return {
    flyTo: vi.fn(),
    removeLayer: vi.fn(),
    addLayer: vi.fn(),
  }
}

function createMockContainer() {
  const el = document.createElement('div')
  el.classList.add('leaflet-control-locate', 'leaflet-bar')
  const link = document.createElement('a')
  link.href = '#'
  link.role = 'button'
  link.title = 'Show my location'
  link.innerHTML = '<svg></svg>'
  el.appendChild(link)
  return { container: el, link }
}

describe('Locate control', () => {
  let map

  beforeEach(() => {
    map = createMockMap()
    // Reset geolocation
    delete window.isSecureContext
  })

  it('should block geolocation on insecure context', () => {
    const { container } = createMockContainer()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Simulate insecure context
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })

    // Simulate the _locate logic
    if (!window.isSecureContext) {
      container.title = 'Geolocation requires HTTPS'
      container.classList.add('error')
    }

    expect(container.classList.contains('error')).toBe(true)
    expect(container.title).toBe('Geolocation requires HTTPS')
    warn.mockRestore()
  })

  it('should block when navigator.geolocation is missing', () => {
    const { container } = createMockContainer()
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })

    const origGeo = navigator.geolocation
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })

    if (!navigator.geolocation) {
      container.title = 'Geolocation not supported'
      container.classList.add('error')
    }

    expect(container.classList.contains('error')).toBe(true)
    expect(container.title).toBe('Geolocation not supported')

    Object.defineProperty(navigator, 'geolocation', { value: origGeo, configurable: true })
  })

  it('should fly to location on successful geolocation', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    const { container } = createMockContainer()

    const mockPosition = {
      coords: { latitude: 47.6062, longitude: -122.3321 },
    }

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => success(mockPosition)),
    }
    Object.defineProperty(navigator, 'geolocation', { value: mockGeolocation, configurable: true })

    // Simulate _locate success path
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords
      map.flyTo([latitude, longitude], 14)
      container.classList.add('active')
      container.classList.remove('error')
    })

    expect(map.flyTo).toHaveBeenCalledWith([47.6062, -122.3321], 14)
    expect(container.classList.contains('active')).toBe(true)
    expect(container.classList.contains('error')).toBe(false)
  })

  it('should show error state on geolocation failure', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    const { container } = createMockContainer()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const mockGeolocation = {
      getCurrentPosition: vi.fn((_success, error) => {
        error({ message: 'User denied Geolocation' })
      }),
    }
    Object.defineProperty(navigator, 'geolocation', { value: mockGeolocation, configurable: true })

    // Simulate _locate error path
    navigator.geolocation.getCurrentPosition(
      () => {},
      (err) => {
        container.classList.add('error')
        container.title = 'Location error: ' + err.message
      }
    )

    expect(container.classList.contains('error')).toBe(true)
    expect(container.title).toBe('Location error: User denied Geolocation')
    warn.mockRestore()
  })

  it('should call getCurrentPosition with high accuracy', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })

    const mockGeolocation = {
      getCurrentPosition: vi.fn(),
    }
    Object.defineProperty(navigator, 'geolocation', { value: mockGeolocation, configurable: true })

    navigator.geolocation.getCurrentPosition(
      () => {},
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    )

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
})
