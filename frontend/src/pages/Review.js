import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const fmt = (n) => Math.round(Math.abs(n)).toLocaleString('en-IN');
const emptyGmailState = { loading: true, connected: false, hasRefreshToken: false, lastSync: null };
const disconnectedGmailState = { loading: false, connected: false, hasRefreshToken: false, lastSync: null };

const formatSyncTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export default function Review() {
  const [pendingTxns, setPendingTxns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [gmail, setGmail] = useState(emptyGmailState);
  const [syncReport, setSyncReport] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, cats, accts, gmailResult, reportResult] = await Promise.allSettled([
        api.pendingTransactions(),
        api.categories(),
        api.accounts(),
        api.gmailStatus(),
        api.gmailReport()
      ]);

      setPendingTxns(pending.status === 'fulfilled' ? pending.value : []);
      setCategories(cats.status === 'fulfilled' ? cats.value : []);
      setAccounts(accts.status === 'fulfilled' ? accts.value : []);
      setGmail(gmailResult.status === 'fulfilled' ? { loading: false, ...gmailResult.value } : disconnectedGmailState);
      setSyncReport(reportResult.status === 'fulfilled' ? reportResult.value : null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReview = (txn) => {
    setForm({
      description: txn.description,
      amount: txn.amount,
      type: txn.type,
      date: String(txn.date).slice(0, 10),
      category_id: txn.category_id || '',
      account_id: txn.account_id || '',
      note: txn.note || '',
      learn_rule: true
    });
    setModal(txn);
  };

  const closeModal = () => {
    setModal(null);
    setForm({});
  };

  const confirmReview = async () => {
    if (!form.category_id) {
      alert('Pick a category before confirming.');
      return;
    }
    try {
      await api.reviewTransaction(modal.id, form);
      closeModal();
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const discard = async (id) => {
    if (!window.confirm('Discard this imported transaction?')) return;
    try {
      await api.deleteTransaction(id);
      closeModal();
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const addCategory = async () => {
    const name = window.prompt('New category name');
    if (!name) return;
    try {
      const created = await api.addCategory({ name });
      const next = [...categories, created].sort((a, b) => a.name.localeCompare(b.name));
      setCategories(next);
      setForm(prev => ({ ...prev, category_id: created.id }));
    } catch (err) {
      alert(err.message);
    }
  };

  const connectGmail = () => {
    setNotice(null);
    window.location.href = api.gmailAuthUrl();
  };

  const sync = async () => {
    if (!gmail.connected) {
      connectGmail();
      return;
    }

    setSyncing(true);
    setNotice(null);
    try {
      const result = await api.gmailSync();
      setSyncReport(result.report || null);
      await load();
      setNotice({
        tone: 'success',
        text: result.imported > 0
          ? `Imported ${result.imported} new transaction${result.imported === 1 ? '' : 's'} into review.`
          : 'Sync finished. Check the report below for parse misses and skipped emails.'
      });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const gmailLabel = gmail.loading
    ? 'checking Gmail...'
    : gmail.connected
      ? (gmail.lastSync ? `last sync ${formatSyncTime(gmail.lastSync)}` : 'Gmail connected')
      : 'Gmail not connected';

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Review</div>
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

      {notice && (
        <div className={`sync-note ${notice.tone}`}>
          {notice.text}
        </div>
      )}

      <div className="section-header">
        <div className="sh" style={{ padding: 0, marginBottom: 0 }}>Needs review</div>
        <div className="review-count">{pendingTxns.length}</div>
      </div>

      {pendingTxns.length > 0 ? (
        <div className="review-list">
          {pendingTxns.map(txn => (
            <button className="review-card" key={txn.id} onClick={() => openReview(txn)}>
              <div className="review-card-top">
                <div className="review-card-title">{txn.description}</div>
                <div className={`row-amt ${txn.type === 'credit' ? 'cr' : ''}`}>
                  {txn.type === 'credit' ? '+' : ''}₹{fmt(txn.amount)}
                </div>
              </div>
              <div className="review-card-meta">
                <span>{String(txn.date).slice(0, 10)}</span>
                <span>{txn.account_name || 'No account matched'}</span>
              </div>
              <div className="review-card-tags">
                <span className="tag pending">{txn.review_reason || 'Pending review'}</span>
                <span className="tag confirm">{txn.category_name || 'Pick category'}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ paddingTop: 16 }}>No transactions waiting for review.</div>
      )}

      {syncReport && (
        <SyncReportCard report={syncReport} />
      )}

      {modal && (
        <div className="modal-overlay open" onClick={e => e.target.className.includes('overlay') && closeModal()}>
          <div className="modal">
            <div className="modal-title">Review transaction</div>
            <div className="review-help">
              Confirm the category and details before this import affects your totals.
            </div>

            <div className="modal-field">
              <div className="modal-label">Type</div>
              <div className="type-toggle">
                <button className={`type-btn ${form.type === 'debit' ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'debit' }))}>Expense</button>
                <button className={`type-btn ${form.type === 'credit' ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'credit' }))}>Income</button>
              </div>
            </div>

            <div className="modal-field">
              <div className="modal-label">Description</div>
              <input className="modal-input" value={form.description || ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Amount (₹)</div>
              <input className="modal-input" type="number" value={form.amount || ''}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Date</div>
              <input className="modal-input" type="date" value={form.date || ''}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Category</div>
              <div className="inline-select-row">
                <select className="modal-select"
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">Uncategorized</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="mini-action" onClick={addCategory}>+ category</button>
              </div>
            </div>

            <div className="modal-field">
              <div className="modal-label">Account</div>
              <select className="modal-select"
                value={form.account_id}
                onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                <option value="">No account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="modal-field">
              <div className="modal-label">Note</div>
              <input className="modal-input" placeholder="Optional note"
                value={form.note || ''}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>

            <label className="modal-check">
              <input
                type="checkbox"
                checked={!!form.learn_rule}
                onChange={e => setForm(f => ({ ...f, learn_rule: e.target.checked }))}
              />
              <span>Remember this merchant for future auto-categorization</span>
            </label>

            <div className="modal-btns">
              <button className="modal-btn danger" onClick={() => discard(modal.id)}>Discard</button>
              <button className="modal-btn save" onClick={confirmReview}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
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
