import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { todayKey } from './service';

const DayContext = createContext<string>(todayKey());

function msUntilNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

export function DayProvider({ children }: { children: ReactNode }) {
  const [day, setDay] = useState<string>(() => todayKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(() => {
        setDay(todayKey());
        arm();
      }, msUntilNextDay(new Date()));
    };
    arm();
    return () => clearTimeout(timer);
  }, []);

  return <DayContext.Provider value={day}>{children}</DayContext.Provider>;
}

export function useDayKey(): string {
  return useContext(DayContext);
}
