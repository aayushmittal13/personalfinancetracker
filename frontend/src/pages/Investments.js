import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const fmt = (n) => Math.round(n).toLocaleString('en-IN');

export default function Investments({ month }) {
  const [investments, setInvestments] = useState([]);
  const [log, setLog] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [ytd, setYtd] = useState({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [selected, setSelected] = useState(null);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, l, a, y, d] = await Promise.all([
        api.investments(),
        api.investmentLog(month),
        api.accounts(),
        api.investmentYtd(),
        api.dashboard(month)
      ]);
      setInvestments(inv);
      setLog(l);
      setAccounts(a);
      setYtd(y);
      setPendingReviewCount(d.pending_review_count || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const sips = investments.filter(i => i.type === 'sip');
  const manual = investments.filter(i => i.type === 'manual');
  const totalMonth = log.reduce((s, l) => s + parseFloat(l.amount), 0);

  const openAdd = (type) => {
    setForm({ name: '', amount: '', type, sip_day: '', account_id: '' });
    setModal('add');
  };

  const save = async () => {
    if (!form.name || !form.amount) return;
    try {
      await api.addInvestment(form);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const del = async (id) => {
    if (!window.confirm('Remove this investment?')) return;
    try {
      await api.deleteInvestment(id);
      setSelected(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const loggedIds = new Set(log.map(l => l.investment_id));

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Investments</div>
      </div>

      <div className="sh">This month</div>
      <div className="inv-summary">
        <div className="inv-sum-block">
          <div className="inv-sum-label">Total invested</div>
          <div className="inv-sum-amt" style={{ color: 'var(--lime)' }}>₹{fmt(totalMonth)}</div>
          <div className="inv-sum-note">{log.length} items · {month}</div>
        </div>
        <div className="inv-sum-block" style={{ borderLeft: '1px solid var(--line)' }}>
          <div className="inv-sum-label">Year to date</div>
          <div className="inv-sum-amt">₹{fmt(ytd.total)}</div>
          <div className="inv-sum-note">{ytd.count} items · {new Date().getFullYear()}</div>
        </div>
      </div>

      {pendingReviewCount > 0 && (
        <div className="nudge">
          {pendingReviewCount} imported transaction{pendingReviewCount === 1 ? '' : 's'} still waiting for review in Txns. Confirm them there before they show up here.
        </div>
      )}

      {/* SIPs */}
      <div className="sh">SIPs</div>
      {sips.length > 0 ? (
        <div className="block">
          {sips.map(inv => (
            <div className="block-row" key={inv.id} onClick={() => setSelected(inv)}>
              <div>
                <div className="row-main">{inv.name}</div>
                <div className="row-meta">
                  {inv.sip_day ? `${inv.sip_day}th every month` : 'Monthly'} · {inv.auto_detect ? 'auto-detect' : 'manual'}
                </div>
              </div>
              <div className="row-right">
                <div className="row-amt" style={{ color: 'var(--lime)' }}>₹{fmt(inv.amount)}</div>
                <div className={`tag ${loggedIds.has(inv.id) ? 'ok' : 'pending'}`}>
                  {loggedIds.has(inv.id) ? 'detected' : 'pending'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ padding: '16px 20px', textAlign: 'left' }}>No SIPs added yet.</div>
      )}
      <div className="add-row" onClick={() => openAdd('sip')}>+ Add SIP</div>

      {/* Manual */}
      <div className="sh" style={{ marginTop: 20 }}>Manual</div>
      {manual.length > 0 ? (
        <div className="block">
          {manual.map(inv => (
            <div className="block-row" key={inv.id} onClick={() => setSelected(inv)}>
              <div>
                <div className="row-main">{inv.name}</div>
                <div className="row-meta">Manual entry</div>
              </div>
              <div className="row-right">
                <div className="row-amt" style={{ color: 'var(--lime)' }}>₹{fmt(inv.amount)}</div>
                <div className="tag manual">manual</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ padding: '16px 20px', textAlign: 'left' }}>No manual investments.</div>
      )}
      <div className="add-row" onClick={() => openAdd('manual')}>+ Add investment</div>

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay open" onClick={e => e.target.className.includes('overlay') && setSelected(null)}>
          <div className="modal">
            <div className="modal-title">{selected.name}</div>
            <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 20, lineHeight: 1.6 }}>
              ₹{fmt(selected.amount)} · {selected.type === 'sip' ? `SIP on ${selected.sip_day || '-'}th` : 'Manual'}
              {selected.account_name ? ` · ${selected.account_name}` : ''}
            </div>
            <div className="modal-btns">
              <button className="modal-btn danger" onClick={() => del(selected.id)}>Remove</button>
              <button className="modal-btn" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {modal === 'add' && (
        <div className="modal-overlay open" onClick={e => e.target.className.includes('overlay') && setModal(null)}>
          <div className="modal">
            <div className="modal-title">{form.type === 'sip' ? 'Add SIP' : 'Add investment'}</div>

            <div className="modal-field">
              <div className="modal-label">Name</div>
              <input className="modal-input" placeholder="e.g. Nifty 50 Index Fund"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Amount (₹)</div>
              <input className="modal-input" type="number" placeholder="0"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            {form.type === 'sip' && (
              <div className="modal-field">
                <div className="modal-label">SIP date (day of month)</div>
                <input className="modal-input" type="number" placeholder="e.g. 5"
                  min="1" max="31"
                  value={form.sip_day} onChange={e => setForm(f => ({ ...f, sip_day: e.target.value }))} />
              </div>
            )}

            {accounts.length > 0 && (
              <div className="modal-field">
                <div className="modal-label">Account</div>
                <select className="modal-select"
                  value={form.account_id}
                  onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                  <option value="">No account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            <div className="modal-btns">
              <button className="modal-btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn save" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
