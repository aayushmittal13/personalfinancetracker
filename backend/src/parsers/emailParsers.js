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
  if (!str) return new Date().toISOString().slice(0, 10);
  // handle dd-mm-yyyy, dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd, dd MMM yyyy
  const parts = str.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (parts) return `${parts[3]}-${parts[2]}-${parts[1]}`;
  const partsShort = str.match(/(\d{2})[-/](\d{2})[-/](\d{2})/);
  if (partsShort) return `20${partsShort[3]}-${partsShort[2]}-${partsShort[1]}`;
  const isoParts = str.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoParts) return `${isoParts[1]}-${isoParts[2]}-${isoParts[3]}`;
  const parts2 = str.match(/(\d{2})\s+(\w{3})\s+(\d{4})/);
  if (parts2) {
    const months = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                     Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    return `${parts2[3]}-${months[parts2[2]]}-${parts2[1]}`;
  }
  return new Date().toISOString().slice(0, 10);
}

// HDFC Bank debit/credit alerts
function parseHDFC(subject, body) {
  const text = `${subject} ${body}`;

  // Debit: "Rs.340.00 debited from A/c **4821 on 15-03-26. Info: SWIGGY"
  const debitMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:has been\s+)?debited\s+from\s+(?:a\/?c|account)?\s*(?:ending\s+|xx|x{2}|\*{2,})?(\d{4})/i);
  if (debitMatch) {
    const merchant = text.match(/(?:Info|towards|at|to)[:\s]+([^\n.]+)/i);
    const dateMatch = text.match(/on\s+([\d\-\/]+)/i) || text.match(/dated?\s+([\d\-\/]+)/i);
    return {
      amount: parseAmount(debitMatch[1]),
      type: 'debit',
      description: merchant ? merchant[1].trim() : 'HDFC debit',
      account_last4: debitMatch[2],
      date: parseDate(dateMatch ? dateMatch[1] : null),
      bank: 'HDFC'
    };
  }

  // Credit: "Rs.85000.00 credited to A/c **4821"
  const creditMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:has been\s+)?credited\s+to\s+(?:a\/?c|account)?\s*(?:ending\s+|xx|x{2}|\*{2,})?(\d{4})/i);
  if (creditMatch) {
    const merchant = text.match(/(?:by|from|Info)[:\s]+([^\n.]+)/i);
    const dateMatch = text.match(/on\s+([\d\-\/]+)/i) || text.match(/dated?\s+([\d\-\/]+)/i);
    return {
      amount: parseAmount(creditMatch[1]),
      type: 'credit',
      description: merchant ? merchant[1].trim() : 'HDFC credit',
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
  const match = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:spent|debited|used)\s+on\s+HDFC.*?(?:XX|x{2}|\*{2,}|ending\s+)(\d{4}).*?(?:at|towards)\s+([^\s][^\n]+?)\s+on\s+([\d\-\/\s\w]+)/i);
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
  const match = text.match(/(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)\s+(?:spent|debited|used).*?(?:XX|x{2}|\*{2,}|ending\s+)(\d{4}).*?(?:at|@|towards)\s+([^\s][^\n]+?)\s+on\s+([\d\-\/]+)/i);
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
  const match = text.match(/(?:ICICI[^\n]*?(?:XX|x{2})(\d{4})[^\n]*?|(?:XX|x{2})(\d{4}).*?ICICI).*?(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?(?:spent at|at)\s+([^\n]+?)\s+on\s+([\d\/\-]+)/i);
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
      date: new Date().toISOString().slice(0, 10),
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
    const dateMatch = text.match(/(?:on|date)[:\s]+([\d\-\/]+)/i);
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

  // Sent: "You have sent Rs.340 to merchant@upi"
  const sentMatch = text.match(/(?:sent|paid|debited)\s+(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:to|towards)\s+([^\s\n]+)/i)
    || text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?\b(?:paid|sent|transferred)\b.*?\bto\b\s+([^\s\n]+)/i);
  if (sentMatch) {
    const dateMatch = text.match(/(?:on|date)[:\s]+([\d\-\/]+)/i);
    return {
      amount: parseAmount(sentMatch[1]),
      type: 'debit',
      description: sentMatch[2].trim(),
      account_last4: null,
      date: parseDate(dateMatch ? dateMatch[1] : null),
      bank: 'UPI'
    };
  }

  // Received: "You have received Rs.6500 from rahul@upi"
  const receivedMatch = text.match(/(?:received|credited)\s+(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)\s+(?:from)\s+([^\s\n]+)/i)
    || text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*).*?\b(?:received|credited)\b.*?\bfrom\b\s+([^\s\n]+)/i);
  if (receivedMatch) {
    const dateMatch = text.match(/(?:on|date)[:\s]+([\d\-\/]+)/i);
    return {
      amount: parseAmount(receivedMatch[1]),
      type: 'credit',
      description: receivedMatch[2].trim(),
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

  // Fallback: try UPI parser for any bank notification
  return parseUPI(subject, body);
}

module.exports = { parseEmail, parseHDFC, parseHDFCCard, parseAxis, parseICICI, parseIndusInd, parseUPI };
