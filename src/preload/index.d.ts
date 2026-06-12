import type { SinoCodeApi } from '../shared/sino-code-api'

export type * from '../shared/sino-code-api'

declare global {
  interface Window {
    sinoCode: SinoCodeApi
  }
}
