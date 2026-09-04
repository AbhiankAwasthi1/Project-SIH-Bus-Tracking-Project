export type KpiRowProps = {
  openCount: number;
  highCount: number;
  fleetCount: number;
};

/**
 * The three numbers an operator needs before reading any list: how much is
 * outstanding, how much of it is urgent, and how many vehicles are reporting.
 */
export function KpiRow({ openCount, highCount, fleetCount }: KpiRowProps) {
  return (
    <section className="kpi-row" aria-label="City summary">
      <div className="kpi">
        <span className="kpi__value">{openCount}</span>
        <span className="kpi__label">Open incidents</span>
      </div>

      <div className={highCount > 0 ? "kpi kpi--alert" : "kpi"}>
        <span className="kpi__value">{highCount}</span>
        <span className="kpi__label">High severity</span>
      </div>

      <div className="kpi">
        <span className="kpi__value">{fleetCount}</span>
        <span className="kpi__label">Fleet reporting</span>
      </div>
    </section>
  );
}
