/**
 * Gmail parsers for Indian bank transaction alert emails.
 * Each parser returns: { amount, type, description, account_last4, date } or null
 */

function parseAmount(str) {
  if (!str) return null;
  const normalized = String(str)
    .replace(/₹|INR|Rs\.?/gi, '')
    .replace(/,/g, '')
    .trim();
  const amount = parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function parseDate(str) {
  if (!str) return null;

  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  const isoParts = str.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoParts) {
    return `${isoParts[1]}-${String(isoParts[2]).padStart(2, '0')}-${String(isoParts[3]).padStart(2, '0')}`;
  }

  const dmy = str.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  }

  const named = str.match(/\b(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-]+(\d{2,4})\b/);
  if (named) {
    const month = months[named[2].slice(0, 3).toLowerCase()];
    const year = named[3].length === 2 ? `20${named[3]}` : named[3];
    if (month) {
      return `${year}-${month}-${String(named[1]).padStart(2, '0')}`;
    }
  }

  return null;
}

function cleanDescription(value, fallback) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:transaction reference number|utr|ref(?:erence)? no\.?|if you did not authorize|warm regards|hdfc bank)\b[\s\S]*$/i, '')
    .trim();
  return normalized || fallback;
}

function hasUpiContext(text) {
  return /\b(?:upi|vpa|utr|transaction reference|ref(?:erence)? number)\b/i.test(text || '');
}

function looksLikeUpiHandle(value) {
  return /[a-z0-9._-]+@[a-z0-9.-]+/i.test(String(value || '').trim());
}

function isGenericNoiseDescription(value) {
  return /^(?:serving|customer|payment|transaction|account|bank|details?)$/i.test(String(value || '').trim());
}

// HDFC Bank debit/credit alerts
function parseHDFC(subject, body) {
  const text = `${subject} ${body}`;

  // Debit: "Rs.340.00 debited from A/c **4821 on 15-03-26. Info: SWIGGY"
  const debitMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:has been\s+)?debited\s+from\s+(?:a\/?c|account)?\s*(?:ending\s+|xx|x{2}|\*{2,})?(\d{4})/i);
  if (debitMatch) {
    const merchant = text.match(/(?:Info|towards|at|to)\s*:?\s+(.+?)(?=\s+on\s+[\dA-Za-z\-\/]+|\.\s+Your\b|,\s*bal\b|$)/i);
    const dateMatch = text.match(/on\s+([\dA-Za-z\-\/\s]+)/i) || text.match(/dated?\s+([\dA-Za-z\-\/\s]+)/i);
    return {
      amount: parseAmount(debitMatch[1]),
      type: 'debit',
      description: cleanDescription(merchant ? merchant[1] : '', 'HDFC debit'),
      account_last4: debitMatch[2],
      date: parseDate(dateMatch ? dateMatch[1] : null),
      bank: 'HDFC'
    };
  }

  // Credit: "Rs.85000.00 credited to A/c **4821"
  const creditMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:has been\s+)?credited\s+to\s+(?:a\/?c|account)?\s*(?:ending\s+|xx|x{2}|\*{2,})?(\d{4})/i);
  if (creditMatch) {
    const merchant = text.match(/(?:by|from|Info)\s*:?\s+(.+?)(?=\s+on\s+[\dA-Za-z\-\/]+|\.\s+Your\b|,\s*bal\b|$)/i);
    const dateMatch = text.match(/on\s+([\dA-Za-z\-\/\s]+)/i) || text.match(/dated?\s+([\dA-Za-z\-\/\s]+)/i);
    return {
      amount: parseAmount(creditMatch[1]),
      type: 'credit',
      description: cleanDescription(merchant ? merchant[1] : '', 'HDFC credit'),
      account_last4: creditMatch[2],
      date: parseDate(dateMatch ? dateMatch[1] : null),
      bank: 'HDFC'
    };
  }

  return null;
}

// HDFC Credit Card
function parseHDFCCard(subject, body) {
  const text = `${subject} ${body}`;

  // "Rs 340 spent on HDFC Bank Credit Card XX4821 at SWIGGY on 2026-03-15"
  const match = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:spent|debited|used)\s+on\s+HDFC.*?(?:XX|x{2}|\*{2,}|ending\s+)(\d{4}).*?(?:at|towards)\s+([^\s][^\n]+?)\s+on\s+([\dA-Za-z\-\/\s]+)/i);
  if (match) {
    return {
      amount: parseAmount(match[1]),
      type: 'debit',
      description: match[3].trim(),
      account_last4: match[2],
      date: parseDate(match[4]),
      bank: 'HDFC_CARD'
    };
  }

  return null;
}

// Axis Bank Card
function parseAxis(subject, body) {
  const text = `${subject} ${body}`;

  // "INR 1,299.00 spent on your Axis Bank Credit Card XX1234 at AMAZON on 15-03-2026"
  const match = text.match(/(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s+(?:spent|debited|used).*?(?:XX|x{2}|\*{2,}|ending\s+)(\d{4}).*?(?:at|@|towards)\s+([^\s][^\n]+?)\s+on\s+([\dA-Za-z\-\/\s]+)/i);
  if (match) {
    return {
      amount: parseAmount(match[1]),
      type: 'debit',
      description: match[3].trim(),
      account_last4: match[2],
      date: parseDate(match[4]),
      bank: 'AXIS'
    };
  }

  return null;
}

// ICICI Bank Card
function parseICICI(subject, body) {
  const text = `${subject} ${body}`;

  // "ICICI Bank Credit Card XX1234: Rs 500.00 spent at ZOMATO on 15/03/2026"
  const match = text.match(/(?:ICICI[^\n]*?(?:XX|x{2})(\d{4})[^\n]*?|(?:XX|x{2})(\d{4}).*?ICICI).*?(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?(?:spent at|at)\s+([^\n]+?)\s+on\s+([\dA-Za-z\/\-\s]+)/i);
  if (match) {
    return {
      amount: parseAmount(match[3]),
      type: 'debit',
      description: match[4].trim(),
      account_last4: match[1] || match[2],
      date: parseDate(match[5]),
      bank: 'ICICI'
    };
  }

  // Alternative: "Your ICICI Bank Credit Card ending 1234 has been used for Rs.500"
  const match2 = text.match(/ICICI.*?ending\s+(\d{4}).*?(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?(?:at|@)\s+([^\n.]+)/i);
  if (match2) {
    return {
      amount: parseAmount(match2[2]),
      type: 'debit',
      description: match2[3].trim(),
      account_last4: match2[1],
      date: null,
      bank: 'ICICI'
    };
  }

  return null;
}

// IndusInd Bank
function parseIndusInd(subject, body) {
  const text = `${subject} ${body}`;

  // "INR 2500.00 debited from IndusInd Bank A/c XX1234 towards MERCHANT"
  const match = text.match(/(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s+(?:debited|spent).*?(?:XX|x{2}|\*{2})(\d{4}).*?(?:towards|at|for)\s+([^\n.]+)/i);
  if (match) {
    const dateMatch = text.match(/(?:on|date)[:\s]+([\dA-Za-z\-\/\s]+)/i);
    return {
      amount: parseAmount(match[1]),
      type: 'debit',
      description: match[3].trim(),
      account_last4: match[2],
      date: parseDate(dateMatch ? dateMatch[1] : null),
      bank: 'INDUSIND'
    };
  }

  return null;
}

// UPI payment confirmation (works across banks)
function parseUPI(subject, body) {
  const text = `${subject} ${body}`;
  if (!hasUpiContext(text)) return null;

  const vpaMatch = text.match(/\b(?:to|from)\s+VPA\s+(.+?)(?=\s+on\s+[\dA-Za-z\-\/]+|\.\s+Your\b|\s+transaction reference|\s+reference number|\s+utr\b|,\s*bal\b|$)/i);
  const vpaDescription = cleanDescription(vpaMatch ? vpaMatch[1] : '', '');

  // Sent: "You have sent Rs.340 to merchant@upi"
  const sentMatch = text.match(/(?:sent|paid|debited)\s+(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:to|towards)\s+([^\s\n]+)/i)
    || text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?\b(?:paid|sent|transferred)\b.*?\bto\b\s+([^\s\n]+)/i);
  if (sentMatch) {
    const rawDescription = vpaDescription || sentMatch[2].trim();
    if (!vpaDescription && !looksLikeUpiHandle(rawDescription)) return null;
    if (isGenericNoiseDescription(rawDescription)) return null;
    const dateMatch = text.match(/(?:on|date)[:\s]+([\dA-Za-z\-\/\s]+)/i);
    return {
      amount: parseAmount(sentMatch[1]),
      type: 'debit',
      description: rawDescription,
      account_last4: null,
      date: parseDate(dateMatch ? dateMatch[1] : null),
      bank: 'UPI'
    };
  }

  // Received: "You have received Rs.6500 from rahul@upi"
  const receivedMatch = text.match(/(?:received|credited)\s+(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:from)\s+([^\s\n]+)/i)
    || text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?\b(?:received|credited)\b.*?\bfrom\b\s+([^\s\n]+)/i);
  if (receivedMatch) {
    const rawDescription = vpaDescription || receivedMatch[2].trim();
    if (!vpaDescription && !looksLikeUpiHandle(rawDescription)) return null;
    if (isGenericNoiseDescription(rawDescription)) return null;
    const dateMatch = text.match(/(?:on|date)[:\s]+([\dA-Za-z\-\/\s]+)/i);
    return {
      amount: parseAmount(receivedMatch[1]),
      type: 'credit',
      description: rawDescription,
      account_last4: null,
      date: parseDate(dateMatch ? dateMatch[1] : null),
      bank: 'UPI'
    };
  }

  return null;
}

// Master parse function - tries all parsers
function parseEmail(subject, body, from) {
  const fromLower = (from || '').toLowerCase();

  if (fromLower.includes('hdfcbank') || fromLower.includes('hdfc')) {
    return parseHDFC(subject, body) || parseHDFCCard(subject, body) || parseUPI(subject, body);
  }
  if (fromLower.includes('axisbank') || fromLower.includes('axis')) {
    return parseAxis(subject, body) || parseUPI(subject, body);
  }
  if (fromLower.includes('icicibank') || fromLower.includes('icici')) {
    return parseICICI(subject, body) || parseUPI(subject, body);
  }
  if (fromLower.includes('indusind')) {
    return parseIndusInd(subject, body) || parseUPI(subject, body);
  }

  return null;
}

module.exports = { parseEmail, parseHDFC, parseHDFCCard, parseAxis, parseICICI, parseIndusInd, parseUPI };
