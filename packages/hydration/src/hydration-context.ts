import { createContext } from 'react';
import type { HydrationState } from './types';

export const HydrationContext = createContext<HydrationState | null>(null);
