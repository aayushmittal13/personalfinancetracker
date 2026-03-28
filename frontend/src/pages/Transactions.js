import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const fmt = (n) => Math.round(Math.abs(n)).toLocaleString('en-IN');

const EMOJIS = {
  Food: '🍜', Transport: '🚗', Subscriptions: '📺',
  Shopping: '🛒', House: '🏠', Investments: '📈',
  Salary: '💰', Others: '💸'
};

export default function Transactions({ month }) {
  const [txns, setTxns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'add' | { txn } for edit
  const [form, setForm] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c, a] = await Promise.all([
        api.transactions(month),
        api.categories(),
        api.accounts()
      ]);
      setTxns(t);
      setCategories(c);
      setAccounts(a);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Group by date
  const grouped = txns.reduce((acc, t) => {
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
    setForm({
      date: new Date().toISOString().slice(0, 10),
      type: 'debit',
      description: '',
      amount: '',
      category_id: categories[0]?.id || '',
      account_id: accounts[0]?.id || ''
    });
    setModal('add');
  };

  const openEdit = (txn) => {
    setForm({ category_id: txn.category_id || '' });
    setModal({ txn });
  };

  const saveAdd = async () => {
    if (!form.description || !form.amount) return;
    try {
      await api.addTransaction(form);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const saveCategory = async () => {
    try {
      await api.updateCategory(modal.txn.id, form.category_id);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const deleteTxn = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    await api.deleteTransaction(id);
    setModal(null);
    load();
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Transactions</div>
      </div>

      <button className="add-txn-btn" onClick={openAdd}>
        + Add transaction
      </button>

      {Object.keys(grouped).length === 0 && (
        <div className="empty">No transactions this month.<br />Add one or sync Gmail.</div>
      )}

      {Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => (
        <div key={date}>
          <div className="txn-date-label">{dateLabel(date)}</div>
          <div className="block">
            {grouped[date].map(txn => (
              <div className="block-row" key={txn.id} onClick={() => openEdit(txn)}>
                <div className="row-left">
                  <div style={{ fontSize: 18, width: 26, textAlign: 'center', flexShrink: 0 }}>
                    {EMOJIS[txn.category_name] || '💸'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row-main">{txn.description}</div>
                    <div className="row-meta">
                      {txn.category_name || 'Uncategorized'} · {txn.account_name || txn.source}
                      {txn.source === 'gmail' && ' · auto'}
                    </div>
                  </div>
                </div>
                <div className="row-right">
                  <div className={`row-amt ${txn.type === 'credit' ? 'cr' : ''}`}>
                    {txn.type === 'credit' ? '+' : ''}₹{fmt(txn.amount)}
                  </div>
                  {txn.is_split && <div className="tag split">split</div>}
                  {!txn.category_id && <div className="tag confirm">categorize?</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add modal */}
      {modal === 'add' && (
        <div className="modal-overlay open" onClick={e => e.target.className.includes('overlay') && setModal(null)}>
          <div className="modal">
            <div className="modal-title">Add transaction</div>

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
              <input className="modal-input" placeholder="e.g. Swiggy, Uber, Salary"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Amount (₹)</div>
              <input className="modal-input" type="number" placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Date</div>
              <input className="modal-input" type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Category</div>
              <select className="modal-select"
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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

            <div className="modal-btns">
              <button className="modal-btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-btn save" onClick={saveAdd}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / category modal */}
      {modal?.txn && (
        <div className="modal-overlay open" onClick={e => e.target.className.includes('overlay') && setModal(null)}>
          <div className="modal">
            <div className="modal-title">{modal.txn.description}</div>
            <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 20, lineHeight: 1.6 }}>
              ₹{fmt(modal.txn.amount)} · {modal.txn.date} · {modal.txn.source}
            </div>

            <div className="modal-field">
              <div className="modal-label">Category</div>
              <select className="modal-select"
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Uncategorized</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="modal-btns">
              <button className="modal-btn danger" onClick={() => deleteTxn(modal.txn.id)}>Delete</button>
              <button className="modal-btn save" onClick={saveCategory}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
