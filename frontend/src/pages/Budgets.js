import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const fmt = (n) => Math.round(Math.abs(n)).toLocaleString('en-IN');

export default function Budgets({ month }) {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        api.budgets(month),
        api.categories()
      ]);
      setBudgets(b);
      setCategories(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    const usedCategoryIds = new Set(budgets.map(b => b.category_id));
    const available = categories.filter(c =>
      !usedCategoryIds.has(c.id) && !['Salary', 'Investments'].includes(c.name)
    );
    setForm({ category_id: available[0]?.id || '', amount: '' });
    setModal('add');
  };

  const save = async () => {
    if (!form.category_id || !form.amount) return;
    try {
      await api.addBudget({ category_id: form.category_id, amount: form.amount, month: null });
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const del = async (id) => {
    if (!window.confirm('Remove this budget?')) return;
    try {
      await api.deleteBudget(id);
      load();
    } catch (e) { alert(e.message); }
  };

  const totalBudget = budgets.reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);
  const overallPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  if (loading) return <div className="loading">Loading...</div>;

  const usedCategoryIds = new Set(budgets.map(b => b.category_id));
  const availableCategories = categories.filter(c =>
    !usedCategoryIds.has(c.id) && !['Salary', 'Investments'].includes(c.name)
  );

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Budgets</div>
      </div>

      {/* Overall summary */}
      <div className="inv-summary">
        <div className="inv-sum-block">
          <div className="inv-sum-label">Total budget</div>
          <div className="inv-sum-amt">₹{fmt(totalBudget)}</div>
          <div className="inv-sum-note">{budgets.length} categories</div>
        </div>
        <div className="inv-sum-block" style={{ borderLeft: '1px solid var(--line)' }}>
          <div className="inv-sum-label">Spent</div>
          <div className="inv-sum-amt" style={{ color: overallPercent > 100 ? 'var(--red)' : overallPercent >= 80 ? 'var(--amber)' : 'var(--green)' }}>
            {overallPercent}%
          </div>
          <div className="inv-sum-note">₹{fmt(totalSpent)} of ₹{fmt(totalBudget)}</div>
        </div>
      </div>

      {/* Budget list */}
      {budgets.length > 0 ? (
        <div className="block">
          {budgets.map(b => (
            <div className="block-row" key={b.id} onClick={() => del(b.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="cat-pip" style={{ background: b.category_color }} />
                    <span className="row-main">{b.category_name}</span>
                  </div>
                  <div className="row-right">
                    <div className="row-amt" style={{ fontSize: 14 }}>₹{fmt(b.spent || 0)}</div>
                    <div className="row-sub">of ₹{fmt(b.amount)}</div>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(b.percent || 0, 100)}%`,
                    background: (b.percent || 0) > 100 ? 'var(--red)' : (b.percent || 0) >= 80 ? 'var(--amber)' : 'var(--green)',
                    borderRadius: 3,
                    transition: 'width 0.3s'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--sub)' }}>
                  <span>₹{fmt(b.remaining || 0)} remaining</span>
                  <span style={{ color: (b.percent || 0) > 100 ? 'var(--red)' : 'var(--sub)' }}>
                    {(b.percent || 0) > 100 ? `${(b.percent || 0) - 100}% over` : `${b.percent || 0}% used`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          No budgets set yet.<br />
          Add budgets to track spending by category.
        </div>
      )}

      {availableCategories.length > 0 && (
        <div className="add-row" onClick={openAdd}>+ Set budget for a category</div>
      )}

      {/* Add modal */}
      {modal === 'add' && (
        <div className="modal-overlay open" onClick={e => e.target.className.includes('overlay') && setModal(null)}>
          <div className="modal">
            <div className="modal-title">Set budget</div>

            <div className="modal-field">
              <div className="modal-label">Category</div>
              <select className="modal-select"
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="modal-field">
              <div className="modal-label">Monthly budget (₹)</div>
              <input className="modal-input" type="number" placeholder="e.g. 5000"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

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
