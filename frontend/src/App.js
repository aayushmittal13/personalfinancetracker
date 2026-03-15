import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Investments from './pages/Investments';
import Fixed from './pages/Fixed';
import Onboarding from './pages/Onboarding';
import { api } from './api/client';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [ready, setReady] = useState(false); // false = loading, true = app, 'onboarding' = setup
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  useEffect(() => {
    api.settings().then(s => {
      setReady(s.onboarding_done === 'true' ? true : 'onboarding');
    }).catch(() => setReady('onboarding'));
  }, []);

  if (!ready) return <div className="loading">Loading...</div>;
  if (ready === 'onboarding') return <Onboarding onComplete={() => setReady(true)} />;

  return (
    <div className="app">
      <div className="page">
        {tab === 'dashboard'    && <Dashboard month={month} setMonth={setMonth} />}
        {tab === 'transactions' && <Transactions month={month} />}
        {tab === 'investments'  && <Investments month={month} />}
        {tab === 'fixed'        && <Fixed />}
      </div>

      <nav className="bnav">
        <button className={`bni ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          <span className="bni-icon">⌂</span>
          <span>Home</span>
        </button>
        <button className={`bni ${tab === 'transactions' ? 'active' : ''}`} onClick={() => setTab('transactions')}>
          <span className="bni-icon">↕</span>
          <span>Txns</span>
        </button>
        <button className={`bni ${tab === 'investments' ? 'active' : ''}`} onClick={() => setTab('investments')}>
          <span className="bni-icon">↗</span>
          <span>Invest</span>
        </button>
        <button className={`bni ${tab === 'fixed' ? 'active' : ''}`} onClick={() => setTab('fixed')}>
          <span className="bni-icon">◈</span>
          <span>Fixed</span>
        </button>
      </nav>
    </div>
  );
}
