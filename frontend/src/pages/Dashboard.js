import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const fmt = (n) => Math.round(n).toLocaleString('en-IN');
const emptyGmailState = { loading: true, connected: false, hasRefreshToken: false, lastSync: null };
const disconnectedGmailState = { loading: false, connected: false, hasRefreshToken: false, lastSync: null };
const formatSyncTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export default function Dashboard({ month, setMonth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [gmail, setGmail] = useState(emptyGmailState);
  const [syncReport, setSyncReport] = useState(null);
  const [syncNotice, setSyncNotice] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setGmail(prev => ({ ...prev, loading: !background }));
    setLoadError(null);
    try {
      const [dashboardResult, gmailResult, reportResult] = await Promise.allSettled([
        api.dashboard(month),
        api.gmailStatus(),
        api.gmailReport()
      ]);

      if (dashboardResult.status === 'fulfilled') {
        setData(dashboardResult.value);
      } else {
        console.error(dashboardResult.reason);
        setData(null);
        setLoadError(dashboardResult.reason?.message || 'Dashboard failed to load.');
      }

      if (gmailResult.status === 'fulfilled') {
        setGmail({ loading: false, ...gmailResult.value });
      } else {
        console.error(gmailResult.reason);
        setGmail(disconnectedGmailState);
      }

      if (reportResult.status === 'fulfilled') {
        setSyncReport(reportResult.value);
      } else {
        console.error(reportResult.reason);
        setSyncReport(null);
      }
    }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const connectGmail = () => {
    setSyncNotice(null);
    window.location.href = api.gmailAuthUrl();
  };

  const sync = async () => {
    if (!gmail.connected) {
      connectGmail();
      return;
    }

    setSyncing(true);
    setSyncNotice(null);
    try {
      const result = await api.gmailSync();
      setSyncReport(result.report || null);
      await load(true);

      if (result.imported > 0) {
        setSyncNotice({
          tone: 'success',
          text: `Imported ${result.imported} new transaction${result.imported === 1 ? '' : 's'}.`
        });
      } else if (result.total === 0) {
        setSyncNotice({
          tone: 'info',
          text: 'Sync ran, but no matching bank emails were found in the recent sync window.'
        });
      } else {
        setSyncNotice({
          tone: 'info',
          text: `Sync finished, but no new transactions were imported. ${result.skipped} email${result.skipped === 1 ? '' : 's'} were skipped.`
        });
      }
    }
    catch (e) {
      const message = e?.message || (typeof e === 'string' ? e : 'Unknown Gmail sync error');
      if (message.includes('Gmail not connected') || message.includes('not connected')) {
        setGmail({ loading: false, connected: false, hasRefreshToken: false, lastSync: null });
        setSyncNotice({
          tone: 'error',
          text: 'Gmail is not connected yet. Tap connect Gmail, approve access, then run sync again.'
        });
      } else if (message.includes('invalid_grant')) {
        setSyncNotice({
          tone: 'error',
          text: 'Google rejected the saved Gmail token. Reconnect Gmail, then run sync again.'
        });
      } else {
        setSyncNotice({ tone: 'error', text: message });
      }
    }
    finally { setSyncing(false); }
  };

  const confirmMatch = async (txn) => {
    // Find flatmate by name from pending match
    const flatmates = await api.flatmates();
    const fm = flatmates.find(f => txn.description.includes(f.upi_id));
    if (fm) {
      await api.confirmPayment({ flatmate_id: fm.id, transaction_id: txn.id, month, amount: txn.amount });
    }
    load();
  };

  const monthLabel = () => {
    const [y, m] = month.split('-');
    return new Date(y, m - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  };

  const prevMonth = () => {
    const [y, m] = month.split('-');
    const d = new Date(y, m - 2);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const [y, m] = month.split('-');
    const d = new Date(y, m);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  if (loading) return <div className="loading">Loading...</div>;

  const b = data?.buckets || {};
  const today = new Date().toISOString().slice(0, 10);
  const hasToday = data?.daily?.some(d => d.date === today);
  const maxBar = Math.max(...(data?.daily?.map(d => parseFloat(d.total)) || [1]));
  const gmailLabel = gmail.loading
    ? 'checking Gmail...'
    : gmail.connected
      ? (gmail.lastSync ? `last sync ${formatSyncTime(gmail.lastSync)}` : 'Gmail connected')
      : 'Gmail not connected';

  return (
    <div>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)', fontSize: 16 }}>‹</button>
          <div className="topbar-title">{monthLabel()}</div>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)', fontSize: 16 }}>›</button>
        </div>
        <div className="topbar-right">
          <div className="sync-status">
            <span className={`sync-dot ${gmail.connected ? '' : 'offline'}`} />
            <span>{gmailLabel}</span>
          </div>
          <button
            className="sync-btn"
            onClick={gmail.connected ? sync : connectGmail}
            disabled={syncing || gmail.loading}
          >
            {gmail.connected ? (syncing ? 'syncing...' : '↻ sync') : 'connect Gmail'}
          </button>
        </div>
      </div>

      {!gmail.loading && !gmail.connected && (
        <div className="nudge">
          Gmail is not connected yet. Tap the connect Gmail button, approve access, then come back and run sync.
        </div>
      )}

      {loadError && (
        <div className="sync-note error">
          {loadError}
        </div>
      )}

      {syncNotice && (
        <div className={`sync-note ${syncNotice.tone}`}>
          {syncNotice.text}
        </div>
      )}

      {syncReport && (
        <SyncReportCard report={syncReport} />
      )}

      {!hasToday && (
        <div className="nudge">Nothing logged today — worth a quick check.</div>
      )}

      <div className="sh">This month</div>
      <div className="buckets">
        <div className="bucket income">
          <div className="b-label">Income</div>
          <div className="b-amt"><span className="sym">₹</span>{fmt(b.income || 0)}</div>
          <div className="b-note">Salary</div>
        </div>
        <div className="bucket">
          <div className="b-label">Spent</div>
          <div className="b-amt"><span className="sym">₹</span>{fmt(b.spent || 0)}</div>
          <div className="b-note">vs ₹{fmt(b.spent_prev || 0)} prev</div>
        </div>
        <div className="bucket recover">
          <div className="b-label">To recover</div>
          <div className="b-amt"><span className="sym">₹</span>{fmt(b.to_recover || 0)}</div>
          <div className="b-note">{b.to_recover_count || 0} people</div>
        </div>
        <div className="bucket invested">
          <div className="b-label">Invested</div>
          <div className="b-amt"><span className="sym">₹</span>{fmt(b.invested || 0)}</div>
          <div className="b-note">{b.invested_count || 0} items</div>
        </div>
        <div className="bucket owed wide">
          <div className="b-label">You owe</div>
          <div className="b-amt"><span className="sym">₹</span>{fmt(b.you_owe || 0)}</div>
          <div className="b-note">Splitwise</div>
        </div>
      </div>

      {data?.insight && (
        <div className="insight">
          <strong>{data.insight.text}</strong> — {data.insight.detail}
        </div>
      )}

      {data?.pending_match && (
        <div className="match">
          <div className="match-top">
            <div className="match-name">{data.pending_match.description}</div>
            <div className="match-amt">₹{fmt(data.pending_match.amount)}</div>
          </div>
          <div className="match-sub">
            {data.pending_match.date} · Is this a flatmate rent payment?
          </div>
          <div className="match-btns">
            <button className="mbtn yes" onClick={() => confirmMatch(data.pending_match)}>
              Yes, settle
            </button>
            <button className="mbtn" onClick={load}>Not this</button>
          </div>
        </div>
      )}

      {/* Spent change indicator */}
      {b.spent_change !== 0 && b.spent_change !== undefined && (
        <div className="nudge" style={{
          borderColor: b.spent_change > 0 ? '#e7bbbb' : '#b8dcc8',
          background: b.spent_change > 0 ? '#fff5f5' : '#f0faf5',
          color: b.spent_change > 0 ? 'var(--red)' : 'var(--green)'
        }}>
          Spending is {b.spent_change > 0 ? 'up' : 'down'} {Math.abs(b.spent_change)}% compared to last month.
        </div>
      )}

      {/* Daily trend */}
      {data?.daily?.length > 0 && (
        <div className="trend-wrap">
          <div className="trend-header">
            <div className="trend-title">Daily spend · last 7 days</div>
          </div>
          <div className="bars">
            {data.daily.map((d, i) => {
              const h = maxBar > 0 ? Math.max(4, (parseFloat(d.total) / maxBar) * 44) : 4;
              const isToday = d.date === today;
              const label = new Date(d.date).getDate();
              return (
                <div className="bc" key={i}>
                  <div className={`b ${isToday ? 'now' : ''}`} style={{ height: h + 'px' }} />
                  <div className="bd">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Savings Rate */}
      {b.savings_rate !== undefined && b.income > 0 && (
        <div className="insight" style={{ borderLeftColor: b.savings_rate >= 20 ? 'var(--green)' : b.savings_rate >= 0 ? 'var(--amber)' : 'var(--red)' }}>
          <strong>Savings rate: {b.savings_rate}%</strong> — {b.savings_rate >= 20 ? 'Great job saving this month!' : b.savings_rate >= 0 ? 'Try to save a bit more.' : 'Spending exceeds income this month.'}
        </div>
      )}

      {/* Budgets */}
      {data?.budgets?.length > 0 && (
        <>
          <div className="sh">Budget tracker</div>
          <div className="block">
            {data.budgets.map((bg, i) => (
              <div className="block-row no-hover" key={i}>
                <div className="row-left" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="cat-pip" style={{ background: bg.color }} />
                      <span className="row-main">{bg.category_name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: bg.percent > 100 ? 'var(--red)' : bg.percent >= 80 ? 'var(--amber)' : 'var(--sub)' }}>
                      {bg.percent}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(bg.percent, 100)}%`,
                      background: bg.percent > 100 ? 'var(--red)' : bg.percent >= 80 ? 'var(--amber)' : 'var(--green)',
                      borderRadius: 2,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--sub)' }}>
                    <span>₹{fmt(bg.spent)} spent</span>
                    <span>₹{fmt(bg.budget)} budget</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Categories */}
      {data?.categories?.length > 0 && (
        <>
          <div className="section-header">
            <div className="sh" style={{ padding: 0, marginBottom: 0 }}>Categories</div>
            <button className="section-action" onClick={() => window.open(api.exportUrl(month), '_blank')}>
              Export CSV
            </button>
          </div>
          <div className="block">
            {data.categories.map((c, i) => (
              <div className="block-row no-hover" key={i}>
                <div className="row-left">
                  <div className="cat-pip" style={{ background: c.color }} />
                  <div>
                    <div className="row-main">{c.name}</div>
                    {c.percent > 0 && <div className="row-meta">{c.percent}% of spend</div>}
                  </div>
                </div>
                <div className="row-right">
                  <div className="row-amt">₹{fmt(c.total)}</div>
                  <div className="row-sub" style={{ color: c.change !== null && c.change > 0 ? 'var(--red)' : c.change !== null && c.change < 0 ? 'var(--green)' : 'var(--sub)' }}>
                    {c.change !== null ? `${c.change > 0 ? '+' : ''}${c.change}% vs prev` : `vs ₹${fmt(c.prev)} prev`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Top Merchants */}
      {data?.top_merchants?.length > 0 && (
        <>
          <div className="sh">Top merchants</div>
          <div className="block">
            {data.top_merchants.map((m, i) => (
              <div className="block-row no-hover" key={i}>
                <div className="row-left">
                  <div style={{ fontSize: 12, color: 'var(--sub)', width: 18, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div className="row-main">{m.description}</div>
                    <div className="row-meta">{m.frequency} transaction{m.frequency !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div className="row-right">
                  <div className="row-amt">₹{fmt(m.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* House */}
      <HouseSection month={month} />
    </div>
  );
}

function HouseSection({ month }) {
  const [flatmates, setFlatmates] = useState([]);
  const [history, setHistory] = useState({});

  useEffect(() => {
    api.flatmateBalances(month).then(setFlatmates).catch(() => {});
  }, [month]);

  useEffect(() => {
    flatmates.forEach(fm => {
      api.flatmateHistory(fm.id).then(h => {
        setHistory(prev => ({ ...prev, [fm.id]: h }));
      }).catch(() => {});
    });
  }, [flatmates]);

  if (!flatmates.length) return null;

  return (
    <>
      <div className="sh" style={{ marginTop: 4 }}>Flatmate balances</div>
      <div className="fm-people">
        {flatmates.map((fm, i) => {
          const short = parseFloat(fm.received) - parseFloat(fm.expected_monthly);
          const settled = short >= 0;
          const hist = history[fm.id] || [];
          return (
            <div className="fm-person" key={fm.id} style={i > 0 ? { borderLeft: '1px solid var(--line)' } : {}}>
              <div className="fm-pname">{fm.name}</div>
              <div className={`fm-pamt ${settled ? 'settled' : 'short'}`}>₹{fmt(fm.received)}</div>
              <div className={`fm-pstatus ${settled ? 'settled' : 'short'}`}>
                {settled ? 'Settled' : `₹${fmt(Math.abs(short))} short`}
              </div>
              <div className="fm-pexp">expected ₹{fmt(fm.expected_monthly)}</div>
              {hist.length > 0 && (
                <div className="fm-hist">
                  <div className="fm-hist-label">History</div>
                  {hist.slice(0, 3).map((h, j) => {
                    const diff = parseFloat(h.received) - parseFloat(h.expected);
                    const ok = diff >= 0;
                    return (
                      <div className={`fm-hist-row ${ok ? 'ok' : ''}`} key={j}>
                        <span>{h.month}</span>
                        <span className="val">{ok ? 'Settled' : `−₹${fmt(Math.abs(diff))}`}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function SyncReportCard({ report }) {
  const metrics = [
    { label: 'Imported', value: report.imported || 0 },
    { label: 'Already imported', value: report.skipped_existing || 0 },
    { label: 'Parse misses', value: report.skipped_unparsed || 0 },
    { label: 'Import errors', value: report.failed || 0 },
    { label: 'Uncategorized', value: report.uncategorized || 0 },
    { label: 'Unknown account', value: report.unmatched_account || 0 }
  ];

  const sampleGroups = [
    { label: 'Parse misses', items: report.parse_failures, render: (item) => `${item.subject} · ${item.preview}` },
    { label: 'Import errors', items: report.import_failures, render: (item) => `${item.subject} · ${item.reason}` },
    { label: 'Uncategorized', items: report.uncategorized_samples, render: (item) => `${item.description} · ₹${fmt(item.amount || 0)}` },
    { label: 'Unknown account', items: report.unmatched_account_samples, render: (item) => `${item.description} · ${item.account_last4 || 'no account match'}` }
  ].filter(group => Array.isArray(group.items) && group.items.length > 0);

  return (
    <div className="sync-report">
      <div className="sync-report-head">
        <div>
          <div className="sync-report-title">Last sync report</div>
          <div className="sync-report-sub">
            {report.status || 'completed'} · scanned {report.total_messages || 0} emails
            {report.completed_at ? ` · ${formatSyncTime(report.completed_at)}` : ''}
          </div>
        </div>
      </div>

      <div className="sync-report-grid">
        {metrics.map(metric => (
          <div className="sync-report-metric" key={metric.label}>
            <div className="sync-report-value">{metric.value}</div>
            <div className="sync-report-label">{metric.label}</div>
          </div>
        ))}
      </div>

      {report.error && (
        <div className="sync-report-error">{report.error}</div>
      )}

      {sampleGroups.map(group => (
        <div className="sync-report-group" key={group.label}>
          <div className="sync-report-group-title">{group.label}</div>
          {group.items.map((item, index) => (
            <div className="sync-report-item" key={`${group.label}-${index}`}>
              {group.render(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
