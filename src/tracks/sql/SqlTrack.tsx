/**
 * Jalur SQL sebagai komponen platform: pembungkus App yang sudah ada (src/App.tsx belum dipindah ke folder ini).
 * App menerima kontrak jalur apa adanya — tampil/tersembunyi, niat masuk dari URL, dan jalan pulang ke Beranda.
 */
import App from '../../App';
import type { TrackProps } from '../../platform/tracks';

export default function SqlTrack({ active, entry, onEntryConsumed, onHome }: TrackProps): JSX.Element {
  return <App active={active} entry={entry} onEntryConsumed={onEntryConsumed} onHome={onHome} />;
}
