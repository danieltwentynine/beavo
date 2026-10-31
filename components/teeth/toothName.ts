import { t } from '@/lib/i18n';
import { toothInfo } from '@/src/data/teeth';

/** Friendly tooth name in the app language, e.g. "Incisivo central superior direito". */
export function toothName(fdi: number): string {
  const info = toothInfo(fdi);
  return t('tooth.name', { kind: t(`tooth.${info.kind}`), arch: t(`tooth.${info.arch}`), side: t(`tooth.${info.side}`) });
}

/** YYYY-MM-DD → the device's short local date. */
export function formatEventDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
