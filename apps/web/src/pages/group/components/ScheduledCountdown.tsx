import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { countdownLabel } from "../../../shared/time/countdown";
export function ScheduledCountdown({ at }: { at: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [at]);
  const label = countdownLabel(at, now);
  if (!label) return null;
  return (
    <div className="scheduled-stamp" role="status">
      <CalendarCheck size={19} aria-hidden="true" />
      <div>
        <strong>Sorteio agendado</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
