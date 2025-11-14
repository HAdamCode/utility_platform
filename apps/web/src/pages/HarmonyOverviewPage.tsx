import { Link } from "react-router-dom";
import HarmonySubNav from "../components/HarmonySubNav";
import { useHarmonyLedgerOverview } from "../modules/useHarmonyLedgerOverview";

const formatCurrencyValue = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);

const HarmonyOverviewPage = () => {
  const { data, isLoading } = useHarmonyLedgerOverview();

  if (isLoading || !data) {
    return (
      <section className="card">
        <HarmonySubNav />
        <p className="muted">Loading Harmony overview…</p>
      </section>
    );
  }

  const currency = "USD";
  return (
    <div className="list" style={{ gap: "1.5rem" }}>
      <section className="card">
        <HarmonySubNav />
        <div className="section-title">
          <div>
            <h2>Harmony Collective Overview</h2>
            <p className="muted">Snapshot of every dollar across Harmony Collective.</p>
          </div>
          <Link className="secondary" to="/harmony-ledger/ledger">
            Go to ledger
          </Link>
        </div>
        <div className="overview-grid">
          <div className="overview-card highlight">
            <p className="muted">Total Harmony Balance</p>
            <h1>{formatCurrencyValue(data.totals.net, currency)}</h1>
            <p className="muted" style={{ marginTop: "0.25rem" }}>
              Donations {formatCurrencyValue(data.totals.donations + data.totals.income, currency)} · Outflows
              {" "}
              {formatCurrencyValue(data.totals.expenses + data.totals.reimbursements, currency)}
            </p>
          </div>
          <div className="overview-card">
            <p className="muted">Unallocated</p>
            <h2>{formatCurrencyValue(data.unallocated.net, currency)}</h2>
            <div className="group-summary-details">
              <span>
                Inflow {formatCurrencyValue(data.unallocated.donations + data.unallocated.income + data.unallocated.transfersIn, currency)}
              </span>
              <span>
                Outflow {formatCurrencyValue(data.unallocated.expenses + data.unallocated.transfersOut, currency)}
              </span>
            </div>
          </div>
          <div className="overview-card">
            <p className="muted">Groups</p>
            <h2>{data.groups.length}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {data.groups.filter((group) => group.net > 0).length} with surplus
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h3>Group Balances</h3>
            <p className="muted">Net allocation per Harmony Collective group.</p>
          </div>
        </div>
        <div className="group-summary-grid">
          {data.groups.map((group) => (
            <div key={group.groupId} className="group-summary-card">
              <p className="muted" style={{ margin: 0 }}>{group.name}</p>
              <h3 style={{ margin: "0.4rem 0" }}>{formatCurrencyValue(group.net, currency)}</h3>
              <div className="group-summary-details">
                <span>
                  ↑ {formatCurrencyValue(group.donations + group.income + group.reimbursements + group.transfersIn, currency)}
                </span>
                <span>
                  ↓ {formatCurrencyValue(group.expenses + group.transfersOut, currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HarmonyOverviewPage;
