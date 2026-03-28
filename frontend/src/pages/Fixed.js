import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const fmt = (n) => Math.round(n).toLocaleString('en-IN');

const ordinal = (n) => {
  if (n >= 11 && n <= 13) return n + 'th';
  const last = n % 10;
  if (last === 1) return n + 'st';
  if (last === 2) return n + 'nd';
  if (last === 3) return n + 'rd';
  return n + 'th';
};

export default function Fixed() {
  const [expenses, setExpenses] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, inv, c, a] = await Promise.all([
        api.fixedExpenses(),
        api.investments(),
        api.categories(),
        api.accounts()
      ]);
      setExpenses(e);
      setInvestments(inv.filter(i => i.is_active));
      setCategories(c);
      setAccounts(a);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalInvestments = investments.reduce((s, i) => s + parseFloat(i.amount), 0);

  const today = new Date().getDate();

  const openAdd = (type) => {
    setForm({
      type,
      name: '',
      amount: '',
      due_day: '',
      category_id: categories[0]?.id || '',
      account_id: ''
    });
    setModal('add');
  };

  const openDetail = (item, type) => {
    setSelected({ ...item, itemType: type });
  };

  const save = async () => {
    if (!form.name || !form.amount) return;
    try {
      if (form.type === 'expense') {
        await api.addFixedExpense({ name: form.name, amount: form.amount, due_day: form.due_day || null, category_id: form.category_id, account_id: form.account_id });
      } else {
        await api.addInvestment({ name: form.name, amount: form.amount, type: 'sip', sip_day: form.due_day || null, account_id: form.account_id });
      }
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const delExpense = async (id) => {
    if (!window.confirm('Remove this fixed expense?')) return;
    try {
      await api.deleteFixedExpense(id);
      setSelected(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const delInvestment = async (id) => {
    if (!window.confirm('Remove this investment?')) return;
    try {
      await api.deleteInvestment(id);
      setSelected(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const statusTag = (dueDay) => {
    if (!dueDay) return <div className="tag ok">entered</div>;
    if (dueDay < today) return <div className="tag ok">detected</div>;
    return <div className="tag pending">due {ordinal(dueDay)}</div>;
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Fixed</div>
      </div>

      {/* Expenses */}
      <div className="fixed-head">
        <div className="fixed-title">Expenses</div>
        <div className="fixed-total">₹{fmt(totalExpenses)}</div>
      </div>

      {expenses.length > 0 ? (
        <div className="block">
          {expenses.map(e => (
            <div className="block-row" key={e.id} onClick={() => openDetail(e, 'expense')}>
              <div>
                <div className="row-main">{e.name}</div>
                <div className="row-meta">
                  {e.due_day ? `${ordinal(e.due_day)} every month` : 'No fixed date'}
                  {e.account_name ? ` · ${e.account_name}` : ''}
                </div>
              </div>
              <div className="row-right">
                <div className="row-amt">₹{fmt(e.amount)}</div>
                {statusTag(e.due_day)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ padding: '16px 20px', textAlign: 'left' }}>
          No fixed expenses yet.
        </div>
      )}
      <div className="add-row" onClick={() => openAdd('expense')}>+ Add fixed expense</div>

      <div className="fixed-sep" />

      {/* Investments */}
      <div className="fixed-head">
        <div className="fixed-title">Investments</div>
        <div className="fixed-total" style={{ color: 'var(--lime)' }}>₹{fmt(totalInvestments)}</div>
      </div>

      {investments.length > 0 ? (
        <div className="block">
          {investments.map(inv => (
            <div className="block-row" key={inv.id} onClick={() => openDetail(inv, 'investment')}>
              <div>
                <div className="row-main">{inv.name}</div>
                <div className="row-meta">
                  {inv.type === 'sip' ? `SIP · ${inv.sip_day ? ordinal(inv.sip_day) + ' every month' : 'monthly'}` : 'Manual'}
                  {inv.account_name ? ` · ${inv.account_name}` : ''}
                </div>
              </div>
              <div className="row-right">
                <div className="row-amt" style={{ color: 'var(--lime)' }}>₹{fmt(inv.amount)}</div>
                {inv.type === 'sip' ? statusTag(inv.sip_day) : <div className="tag manual">manual</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ padding: '16px 20px', textAlign: 'left' }}>
          No fixed investments yet.
        </div>
      )}
      <div className="add-row" onClick={() => openAdd('investment')}>+ Add investment</div>

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay open" onClick={e => e.target.className.includes('overlay') && setSelected(null)}>
          <div className="modal">
            <div className="modal-title">{selected.name}</div>
            <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 20, lineHeight: 1.6 }}>
              ₹{fmt(selected.amount)} · {selected.due_day || selected.sip_day ? `${ordinal(selected.due_day || selected.sip_day)} every month` : 'No fixed date'}
              {selected.account_name ? ` · ${selected.account_name}` : ''}
            </div>
            <div className="modal-btns">
              <button className="modal-btn danger" onClick={() => selected.itemType === 'expense' ? delExpense(selected.id) : delInvestment(selected.id)}>Remove</button>
              <button className="modal-btn" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {modal === 'add' && (
        <div className="modal-overlay open" onClick={e => e.target.className.includes('overlay') && setModal(null)}>
          <div className="modal">
            <div className="modal-title">
              {form.type === 'expense' ? 'Add fixed expense' : 'Add investment'}
            </div>

            <div className="modal-field">
              <div className="modal-label">Name</div>
              <input className="modal-input"
                placeholder={form.type === 'expense' ? 'e.g. Rent, WiFi, Cook salary' : 'e.g. Nifty 50 Index'}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">Amount (₹)</div>
              <input className="modal-input" type="number" placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            <div className="modal-field">
              <div className="modal-label">
                {form.type === 'expense' ? 'Due on (day of month)' : 'SIP date (day of month)'}
              </div>
              <input className="modal-input" type="number" placeholder="e.g. 1 for 1st, 5 for 5th"
                min="1" max="31"
                value={form.due_day}
                onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} />
            </div>

            {form.type === 'expense' && (
              <div className="modal-field">
                <div className="modal-label">Category</div>
                <select className="modal-select"
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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
