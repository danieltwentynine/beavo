import { useEffect, useState } from 'react';

import { watchLocalChildren } from '@/src/data/local';

/** First names of the children kept on this device without an account; null until the device data has been read. */
export function useLocalChildNames(): string[] | null {
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => watchLocalChildren((children) => setNames(children.map((c) => c.name))), []);
  return names;
}
