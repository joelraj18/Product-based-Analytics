import { useCallback, useEffect, useState } from 'react';
import { load, save } from '../lib/storage';

// useState mirrored to localStorage under `workx_<key>`. `initial` may be a
// value or a lazy factory, used only when nothing is stored yet. Seeded
// defaults are persisted too, so SQL Lab and backups see what the UI shows.
const usePersistentState = (key, initial) => {
  const [value, setValue] = useState(() => {
    const stored = load(key, undefined);
    if (stored !== undefined) return stored;
    return typeof initial === 'function' ? initial() : initial;
  });

  useEffect(() => { save(key, value); }, [key, value]);

  const reset = useCallback(() => {
    setValue(typeof initial === 'function' ? initial() : initial);
  }, [initial]);

  return [value, setValue, reset];
};

export default usePersistentState;
