import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const fmt = (n) => Math.round(Math.abs(n)).toLocaleString('en-IN');

const EMOJIS = {
  Food: '🍜', Transport: '🚗', Subscriptions: '📺',
  Shopping: '🛒', House: '🏠', Investments: '📈',
  Salary: '💰', Health: '🏥', Others: '💸'
};

function emptyForm(categories) {
  return {
    date: new Date().toISOString().slice(0, 10),
    type: 'debit',
    description: '',
    amount: '',
    category_id: categories[0]?.id || '',
    account_id: '',
    note: '',
    learn_rule: true
  };
}

export default function Transactions({ month }) {
  const [txns, setTxns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, c, a] = await Promise.allSettled([
        api.transactions(month),
        api.categories(),
        api.accounts()
      ]);

      if (t.status === 'fulfilled') setTxns(t.value);
      else {
        console.error(t.reason);
        setTxns([]);
        setLoadError(t.reason?.message || 'Transactions failed to load.');
      }

      if (c.status === 'fulfilled') setCategories(c.value);
      else {
        console.error(c.reason);
        setCategories([]);
      }

      if (a.status === 'fulfilled') setAccounts(a.value);
      else {
        console.error(a.reason);
        setAccounts([]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const matchesSearch = useCallback((txn) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      txn.description.toLowerCase().includes(query) ||
      (txn.category_name || '').toLowerCase().includes(query) ||
      (txn.review_reason || '').toLowerCase().includes(query)
    );
  }, [search]);

  const filteredPending = pendingTxns.filter(matchesSearch);
  const filtered = txns.filter(matchesSearch);

  const grouped = filtered.reduce((acc, t) => {
    const key = t.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const dateLabel = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    const normalized = String(dateStr).includes('T') ? String(dateStr) : `${dateStr}T00:00:00`;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return 'Unknown date';
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const openAdd = () => {
    setForm(emptyForm(categories));
    setModal({ mode: 'add' });
  };

  const openEdit = (txn, mode = 'edit') => {
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
    setModal({ mode, txn });
  };

  const closeModal = () => {
    setModal(null);
    setForm({});
  };

  const saveAdd = async () => {
    if (!form.description || !form.amount) return;
    try {
      await api.addTransaction(form);
      closeModal();
      load();
    } catch (e) { alert(e.message); }
  };

  const saveEdit = async () => {
    try {
      await api.updateTransaction(modal.txn.id, form);
      closeModal();
      load();
    } catch (e) { alert(e.message); }
  };

  const confirmReview = async () => {
    if (!form.category_id) {
      alert('Pick a category before confirming.');
      return;
    }
    try {
      await api.reviewTransaction(modal.txn.id, form);
      closeModal();
      load();
    } catch (e) { alert(e.message); }
  };

  const deleteTxn = async (id, copy = 'Delete this transaction?') => {
    if (!window.confirm(copy)) return;
    try {
      await api.deleteTransaction(id);
      closeModal();
      load();
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const addCategory = async () => {
    const name = window.prompt('New category name');
    if (!name) return;
    try {
      const created = await api.addCategory({ name });
      const next = [...categories, created].sort((a, b) => a.name.localeCompare(b.name));
      setCategories(next);
      setForm(prev => ({ ...prev, category_id: created.id }));
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Transactions</div>
      </div>

      <div style={{ padding: '0 20px 12px' }}>
        <input
          className="modal-input"
          placeholder="Search transactions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 12 }}
        />
      </div>

      <button className="add-txn-btn" onClick={openAdd}>
        + Add transaction
      </button>

      {loadError && (
        <div className="sync-note error">
          {loadError}
        </div>
      )}

      {Object.keys(grouped).length === 0 && (
        <div className="empty">
          {search ? 'No matching transactions.' : 'No transactions this month.'}<br />
          {!search && 'Add one or review imports first.'}
        </div>
      )}

      {Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => (
        <div key={date}>
          <div className="txn-date-label">{dateLabel(date)}</div>
          <div className="block">
            {grouped[date].map(txn => (
              <div className="block-row" key={txn.id} onClick={() => openEdit(txn, 'edit')}>
                <div className="row-left">
                  <div style={{ fontSize: 18, width: 26, textAlign: 'center', flexShrink: 0 }}>
                    {EMOJIS[txn.category_name] || '💸'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row-main">{txn.description}</div>
                    <div className="row-meta">
                      {txn.category_name || 'Uncategorized'} · {txn.account_name || txn.source}
                      {txn.source === 'gmail' && ' · reviewed'}
                    </div>
                  </div>
                </div>
                <div className="row-right">
                  <div className={`row-amt ${txn.type === 'credit' ? 'cr' : ''}`}>
                    {txn.type === 'credit' ? '+' : ''}₹{fmt(txn.amount)}
                  </div>
                  {txn.is_split && <div className="tag split">split</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {modal && (
        <div className="modal-overlay open" onClick={e => e.target.className.includes('overlay') && closeModal()}>
          <div className="modal">
            <div className="modal-title">
              {modal.mode === 'add' ? 'Add transaction' : modal.mode === 'review' ? 'Review transaction' : 'Edit transaction'}
            </div>

            {modal.mode === 'review' && (
              <div className="review-help">
                Confirm the category and details before this import counts toward your totals.
              </div>
            )}

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
              <input className="modal-input"
                placeholder="e.g. Swiggy, Uber, Salary"
                value={form.description || ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Amount (₹)</div>
              <input className="modal-input" type="number"
                value={form.amount || ''}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Date</div>
              <input className="modal-input" type="date"
                value={form.date || ''}
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

            <div className="modal-field">
              <div className="modal-label">Note</div>
              <input className="modal-input" placeholder="Optional note"
                value={form.note || ''}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>

            {modal.mode === 'review' && (
              <label className="modal-check">
                <input
                  type="checkbox"
                  checked={!!form.learn_rule}
                  onChange={e => setForm(f => ({ ...f, learn_rule: e.target.checked }))}
                />
                <span>Remember this merchant for future auto-categorization</span>
              </label>
            )}

            <div className="modal-btns">
              {modal.mode === 'add' && (
                <>
                  <button className="modal-btn" onClick={closeModal}>Cancel</button>
                  <button className="modal-btn save" onClick={saveAdd}>Save</button>
                </>
              )}

              {modal.mode === 'edit' && (
                <>
                  <button className="modal-btn danger" onClick={() => deleteTxn(modal.txn.id)}>Delete</button>
                  <button className="modal-btn save" onClick={saveEdit}>Save</button>
                </>
              )}

              {modal.mode === 'review' && (
                <>
                  <button className="modal-btn danger" onClick={() => deleteTxn(modal.txn.id, 'Discard this imported transaction?')}>Discard</button>
                  <button className="modal-btn save" onClick={confirmReview}>Confirm</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
