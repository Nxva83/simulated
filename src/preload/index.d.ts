import type { EpikodiApi } from '@shared/ipc';

declare global {
  interface Window {
    epikodi: EpikodiApi;
  }
}
