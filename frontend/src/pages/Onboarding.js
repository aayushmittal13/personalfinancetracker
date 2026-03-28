import React, { useState } from 'react';
import { api } from '../api/client';

const STEPS = ['salary', 'accounts', 'flatmates', 'fixed'];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    salary: '',
    salary_day: '1',
    accounts: [{ name: 'HDFC Savings', type: 'bank', bank: 'HDFC', last4: '' }],
    flatmates: [{ name: '', upi_id: '', expected_monthly: '' }],
    fixed: [
      { name: 'Rent', amount: '', due_day: '1', category: 'House' },
      { name: 'WiFi', amount: '', due_day: '8', category: 'House' }
    ],
    investments: [{ name: '', amount: '', sip_day: '5', type: 'sip' }]
  });

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (data.salary) await api.setSetting('salary', data.salary);
      if (data.salary_day) await api.setSetting('salary_day', data.salary_day);

      for (const acc of data.accounts) {
        if (acc.name && acc.bank && acc.last4) await api.addAccount(acc).catch(() => {});
      }

      for (const fm of data.flatmates) {
        if (fm.name && fm.expected_monthly) await api.addFlatmate(fm).catch(() => {});
      }

      const categories = await api.categories();
      for (const fe of data.fixed) {
        if (fe.name && fe.amount) {
          const cat = categories.find(c => c.name === fe.category);
          await api.addFixedExpense({ ...fe, category_id: cat?.id }).catch(() => {});
        }
      }

      for (const inv of data.investments) {
        if (inv.name && inv.amount) await api.addInvestment(inv).catch(() => {});
      }

      await api.setSetting('onboarding_done', 'true');
      onComplete();
    } catch (e) {
      alert('Setup error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = (i) => setData(d => ({ ...d, accounts: d.accounts.filter((_, j) => j !== i) }));
  const removeFlatmate = (i) => setData(d => ({ ...d, flatmates: d.flatmates.filter((_, j) => j !== i) }));
  const removeFixed = (i) => setData(d => ({ ...d, fixed: d.fixed.filter((_, j) => j !== i) }));
  const removeInvestment = (i) => setData(d => ({ ...d, investments: d.investments.filter((_, j) => j !== i) }));

  const updateAccount = (i, key, val) => {
    const updated = [...data.accounts];
    updated[i] = { ...updated[i], [key]: val };
    setData(d => ({ ...d, accounts: updated }));
  };

  const updateFlatmate = (i, key, val) => {
    const updated = [...data.flatmates];
    updated[i] = { ...updated[i], [key]: val };
    setData(d => ({ ...d, flatmates: updated }));
  };

  const updateFixed = (i, key, val) => {
    const updated = [...data.fixed];
    updated[i] = { ...updated[i], [key]: val };
    setData(d => ({ ...d, fixed: updated }));
  };

  const updateInvestment = (i, key, val) => {
    const updated = [...data.investments];
    updated[i] = { ...updated[i], [key]: val };
    setData(d => ({ ...d, investments: updated }));
  };

  return (
    <div className="onboarding">
      <div className="progress-dots">
        {STEPS.map((_, i) => (
          <div key={i} className={`dot ${i <= step ? 'active' : ''}`} />
        ))}
      </div>

      {/* Step 0: Salary */}
      {step === 0 && (
        <div>
          <div className="onboarding-step">Step 1 of 4</div>
          <div className="onboarding-title">Your salary</div>
          <div className="onboarding-sub">
            This helps the app know what you earn each month so the numbers make sense.
          </div>

          <div className="onboarding-field">
            <div className="modal-label">Monthly salary (₹)</div>
            <input className="modal-input" type="number" placeholder="e.g. 85000"
              value={data.salary}
              onChange={e => setData(d => ({ ...d, salary: e.target.value }))} />
          </div>
          <div className="onboarding-field">
            <div className="modal-label">Credit date (day of month)</div>
            <input className="modal-input" type="number" placeholder="1" min="1" max="31"
              value={data.salary_day}
              onChange={e => setData(d => ({ ...d, salary_day: e.target.value }))} />
          </div>

          <div className="onboarding-btns">
            <button className="ob-btn primary" onClick={next}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 1: Accounts */}
      {step === 1 && (
        <div>
          <div className="onboarding-step">Step 2 of 4</div>
          <div className="onboarding-title">Your accounts</div>
          <div className="onboarding-sub">
            Add your bank accounts and cards. The last 4 digits help match transactions.
          </div>

          {data.accounts.map((acc, i) => (
            <div key={i} style={{ marginBottom: 16, padding: 14, background: 'var(--white)', borderRadius: 10, border: '1px solid var(--line)', position: 'relative' }}>
              {data.accounts.length > 1 && (
                <button onClick={() => removeAccount(i)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
              <div className="onboarding-field">
                <div className="modal-label">Name</div>
                <input className="modal-input" placeholder="e.g. HDFC Savings"
                  value={acc.name} onChange={e => updateAccount(i, 'name', e.target.value)} />
              </div>
              <div className="onboarding-field">
                <div className="modal-label">Bank</div>
                <select className="modal-select"
                  value={acc.bank} onChange={e => updateAccount(i, 'bank', e.target.value)}>
                  <option>HDFC</option>
                  <option>Central Bank</option>
                  <option>Axis</option>
                  <option>ICICI</option>
                  <option>IndusInd</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="onboarding-field">
                <div className="modal-label">Type</div>
                <select className="modal-select"
                  value={acc.type} onChange={e => updateAccount(i, 'type', e.target.value)}>
                  <option value="bank">Savings / Current</option>
                  <option value="card">Credit Card</option>
                </select>
              </div>
              <div className="onboarding-field" style={{ marginBottom: 0 }}>
                <div className="modal-label">Last 4 digits</div>
                <input className="modal-input" placeholder="e.g. 4821" maxLength="4"
                  value={acc.last4} onChange={e => updateAccount(i, 'last4', e.target.value)} />
              </div>
            </div>
          ))}

          <div className="add-row" onClick={() => setData(d => ({
            ...d,
            accounts: [...d.accounts, { name: '', type: 'bank', bank: 'HDFC', last4: '' }]
          }))}>
            + Add another account
          </div>

          <div className="onboarding-btns">
            <button className="ob-btn" onClick={back}>← Back</button>
            <button className="ob-btn primary" onClick={next}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 2: Flatmates */}
      {step === 2 && (
        <div>
          <div className="onboarding-step">Step 3 of 4</div>
          <div className="onboarding-title">Flatmates</div>
          <div className="onboarding-sub">
            Add your flatmates and their UPI IDs. The app will auto-match incoming payments to them.
          </div>

          {data.flatmates.map((fm, i) => (
            <div key={i} style={{ marginBottom: 14, padding: 14, background: 'var(--white)', borderRadius: 10, border: '1px solid var(--line)', position: 'relative' }}>
              {data.flatmates.length > 1 && (
                <button onClick={() => removeFlatmate(i)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
              <div className="onboarding-field">
                <div className="modal-label">Name</div>
                <input className="modal-input" placeholder="e.g. Rahul"
                  value={fm.name} onChange={e => updateFlatmate(i, 'name', e.target.value)} />
              </div>
              <div className="onboarding-field">
                <div className="modal-label">UPI ID</div>
                <input className="modal-input" placeholder="e.g. rahul@upi"
                  value={fm.upi_id} onChange={e => updateFlatmate(i, 'upi_id', e.target.value)} />
              </div>
              <div className="onboarding-field" style={{ marginBottom: 0 }}>
                <div className="modal-label">Expected monthly payment (₹)</div>
                <input className="modal-input" type="number" placeholder="e.g. 8000"
                  value={fm.expected_monthly} onChange={e => updateFlatmate(i, 'expected_monthly', e.target.value)} />
              </div>
            </div>
          ))}

          <div className="add-row" onClick={() => setData(d => ({
            ...d,
            flatmates: [...d.flatmates, { name: '', upi_id: '', expected_monthly: '' }]
          }))}>
            + Add another flatmate
          </div>

          <div className="onboarding-btns">
            <button className="ob-btn" onClick={back}>← Back</button>
            <button className="ob-btn primary" onClick={next}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 3: Fixed expenses + investments */}
      {step === 3 && (
        <div>
          <div className="onboarding-step">Step 4 of 4</div>
          <div className="onboarding-title">Fixed expenses</div>
          <div className="onboarding-sub">
            Add recurring monthly expenses. You can always add more later.
          </div>

          {data.fixed.map((fe, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                {i === 0 && <div className="modal-label">Name</div>}
                <input className="modal-input" placeholder="e.g. Rent"
                  value={fe.name} onChange={e => updateFixed(i, 'name', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                {i === 0 && <div className="modal-label">Amount</div>}
                <input className="modal-input" type="number" placeholder="₹"
                  value={fe.amount} onChange={e => updateFixed(i, 'amount', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                {i === 0 && <div className="modal-label">Due day</div>}
                <input className="modal-input" type="number" placeholder="1" min="1" max="31"
                  value={fe.due_day} onChange={e => updateFixed(i, 'due_day', e.target.value)} />
              </div>
              <button onClick={() => removeFixed(i)} style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 14, marginBottom: 2 }}>✕</button>
            </div>
          ))}

          <div className="add-row" style={{ marginBottom: 24 }} onClick={() => setData(d => ({
            ...d,
            fixed: [...d.fixed, { name: '', amount: '', due_day: '', category: 'House' }]
          }))}>
            + Add expense
          </div>

          <div className="modal-label" style={{ padding: '0 0 8px' }}>SIP / Investments</div>
          {data.investments.map((inv, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                {i === 0 && <div className="modal-label">Fund name</div>}
                <input className="modal-input" placeholder="e.g. Nifty 50 SIP"
                  value={inv.name} onChange={e => updateInvestment(i, 'name', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                {i === 0 && <div className="modal-label">Amount</div>}
                <input className="modal-input" type="number" placeholder="₹"
                  value={inv.amount} onChange={e => updateInvestment(i, 'amount', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                {i === 0 && <div className="modal-label">SIP day</div>}
                <input className="modal-input" type="number" placeholder="5"
                  value={inv.sip_day} onChange={e => updateInvestment(i, 'sip_day', e.target.value)} />
              </div>
              <button onClick={() => removeInvestment(i)} style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 14, marginBottom: 2 }}>✕</button>
            </div>
          ))}
          <div className="add-row" onClick={() => setData(d => ({
            ...d,
            investments: [...d.investments, { name: '', amount: '', sip_day: '', type: 'sip' }]
          }))}>
            + Add SIP
          </div>

          <div className="onboarding-btns">
            <button className="ob-btn" onClick={back}>← Back</button>
            <button className="ob-btn primary" onClick={finish} disabled={saving}>{saving ? 'Saving...' : 'Finish setup →'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
