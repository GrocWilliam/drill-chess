import type { Lang } from '$lib/i18n';
import type { SessionUser } from '$lib/server/accounts';

declare global {
  namespace App {
    interface Locals {
      lang: Lang;
      theme: 'light' | 'dark' | null;
      /** The signed-in user, from the `session` cookie; null when signed out. */
      user: SessionUser | null;
    }
  }
}

export {};
