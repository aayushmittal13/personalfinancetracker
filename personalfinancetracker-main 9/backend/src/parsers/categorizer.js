const RULES = {
  Investments: [
    'zerodha', 'groww', 'kuvera', 'coin', 'mutual fund', 'sip', 'nps',
    'ppf', 'elss', 'fixed deposit', 'upstox', 'angel one', 'angel broking',
    '5paisa', 'paytm money', 'iifl', 'motilal oswal', 'hdfc securities',
    'icici direct', 'kotak securities', 'axis direct', 'geojit', 'smallcase',
    'scripbox', 'et money', 'stock', 'share', 'equity', 'debenture', 'bond',
    'gold bond', 'sgb', 'index fund', 'debt fund', 'liquid fund', 'gilt',
    'digital gold', 'gold etf', 'recurring deposit', 'post office',
    'sukanya samriddhi', 'capital gain', 'dividend', 'interest earned',
    'amc', 'folio', 'nav', 'units'
  ],
  Salary: [
    'salary', 'payroll', 'stipend', 'ctc', 'employer', 'wages',
    'remuneration', 'compensation', 'bonus', 'incentive', 'commission',
    'freelance payment', 'consulting fee', 'arrears', 'gratuity',
    'provident fund credit', 'neft salary', 'imps salary', 'monthly credit'
  ],
  Health: [
    'hospital', 'doctor', 'clinic', 'medical', 'medicine', 'pharmacy',
    'chemist', 'apollo', 'fortis', 'max hospital', 'medanta', 'narayana',
    'manipal', 'aiims', 'practo', 'pharmeasy', 'netmeds', '1mg',
    'medplus', 'dentist', 'dental', 'diagnostic', 'pathology', 'blood test',
    'mri', 'ct scan', 'thyrocare', 'lal path', 'dr lal', 'srl', 'gym',
    'fitness', 'yoga', 'cult fit', 'cultfit', 'anytime fitness',
    'physiotherapy', 'therapy', 'counselling', 'psychologist', 'vaccination',
    'vaccine', 'consultation', 'ambulance', 'mediclaim'
  ],
  House: [
    'rent', 'maintenance', 'electricity', 'bescom', 'wifi', 'airtel', 'jio',
    'bsnl', 'water', 'gas', 'cook', 'maid', 'society', 'broadband',
    'internet', 'fiber', 'act fibernet', 'hathway', 'tikona', 'dish tv',
    'sun direct', 'cable', 'indane', 'hp gas', 'bharat gas', 'lpg',
    'piped gas', 'tata power', 'adani electricity', 'water bill',
    'property tax', 'house keeping', 'cleaning', 'laundry', 'dry clean',
    'plumber', 'electrician', 'carpenter', 'painting', 'repair',
    'renovation', 'furniture', 'mattress', 'bedsheet', 'curtain', 'kitchen',
    'utensil', 'appliance', 'washing machine', 'refrigerator', 'fridge',
    'fan', 'geyser', 'water purifier', 'aquaguard', 'security deposit',
    'brokerage', 'society maintenance', 'apartment', 'flat', 'garbage',
    'waste', 'housing loan', 'home loan', 'mobile bill', 'phone bill'
  ],
  Transport: [
    'uber', 'ola', 'rapido', 'irctc', 'makemytrip', 'goibibo', 'cleartrip',
    'metro', 'petrol', 'fuel', 'parking', 'toll', 'redbus', 'yatra',
    'indigo', 'air india', 'spicejet', 'vistara', 'akasa', 'go first',
    'flybus', 'easemytrip', 'ixigo', 'trainman', 'confirmtkt', 'namma yatri',
    'meru', 'savaari', 'cab', 'taxi', 'auto', 'rickshaw', 'bike taxi', 'bus',
    'train', 'flight', 'airline', 'airport', 'diesel', 'cng', 'ev charging',
    'fastag', 'iocl', 'bharat petroleum', 'shell', 'indian oil', 'nayara',
    'mechanic', 'puncture', 'tyre', 'tire', 'car wash', 'challan',
    'fine traffic', 'zoomcar', 'revv', 'bounce', 'yulu', 'self drive'
  ],
  Food: [
    'swiggy', 'zomato', 'zepto', 'blinkit', 'dunzo', 'bigbasket', 'grofers',
    'instamart', 'restaurant', 'cafe', 'dining', 'food', 'pizza', 'burger',
    'dominos', 'mcdonalds', 'kfc', 'subway', 'starbucks', 'chaayos',
    'haldiram', 'biryani', 'bakery', 'cake', 'sweet', 'mithai', 'ice cream',
    'baskin', 'dosa', 'idli', 'thali', 'meal', 'lunch', 'dinner',
    'breakfast', 'snack', 'chai', 'tea', 'coffee', 'juice', 'smoothie',
    'milkshake', 'licious', 'freshmenu', 'faasos', 'behrouz', 'eatfit',
    'box8', 'dmart', 'jiomart', 'bb daily', 'milkbasket', 'supr daily',
    'cafe coffee day', 'barista', 'third wave', 'blue tokai', 'burger king',
    'pizza hut', 'wow momo', 'krispy kreme', 'saravana bhavan', 'beer', 'bar',
    'pub', 'liquor', 'alcohol'
  ],
  Shopping: [
    'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'snapdeal',
    'shopclues', 'reliance digital', 'lifestyle', 'westside', 'tata cliq',
    'croma', 'vijay sales', 'decathlon', 'nike', 'adidas', 'puma', 'reebok',
    'fila', 'uniqlo', 'levis', 'wrangler', 'pantaloons', 'max fashion',
    'shoppers stop', 'lenskart', 'firstcry', 'mamaearth', 'boat', 'noise',
    'fire-boltt', 'oneplus', 'samsung', 'xiaomi', 'iphone', 'macbook', 'ipad',
    'ikea', 'pepperfry', 'urban ladder', 'fabindia', 'biba', 'mango',
    'forever 21', 'bewakoof', 'the souled store', 'titan', 'fastrack',
    'tanishq', 'malabar', 'jewellery', 'jewelry', 'gold', 'silver', 'diamond',
    'gift', 'present', 'bouquet', 'ferns n petals', 'toy', 'game', 'book',
    'stationery', 'crossword'
  ],
  Subscriptions: [
    'netflix', 'spotify', 'hotstar', 'prime', 'youtube', 'apple music',
    'apple one', 'microsoft', 'adobe', 'github', 'notion', 'figma', 'slack',
    'zoom', 'disney', 'jio cinema', 'sonyliv', 'zee5', 'voot', 'mubi',
    'amazon prime', 'prime video', 'audible', 'kindle unlimited', 'google one',
    'icloud', 'dropbox', 'evernote', 'todoist', 'canva', 'grammarly',
    'chatgpt', 'openai', 'anthropic', 'claude', 'linkedin premium', 'medium',
    'substack', 'patreon', 'subscription', 'renewal', 'membership',
    'annual plan', 'monthly plan', 'coursera', 'udemy', 'skillshare',
    'masterclass', 'unacademy', 'codeforces', 'leetcode', 'hackerrank',
    'headspace', 'calm', 'strava', 'fitbit', 'wynk', 'gaana', 'jiosaavn'
  ]
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildKeywordRegex(keyword) {
  const normalized = normalizeText(keyword);
  const body = escapeRegex(normalized).replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${body}(?=$|[^a-z0-9])`, 'i');
}

function getKeywordScore(text, keyword) {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return 0;
  return buildKeywordRegex(normalizedKeyword).test(text)
    ? normalizedKeyword.replace(/\s+/g, '').length
    : 0;
}

function ruleBasedCategory(description) {
  const text = normalizeText(description);
  if (!text) return null;

  let bestCategory = null;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(RULES)) {
    let categoryScore = 0;

    for (const keyword of keywords) {
      categoryScore = Math.max(categoryScore, getKeywordScore(text, keyword));
    }

    if (categoryScore > bestScore) {
      bestCategory = category;
      bestScore = categoryScore;
    }
  }

  return bestCategory;
}

function merchantKeyFromDescription(description) {
  const stopwords = new Set([
    'vpa', 'upi', 'to', 'from', 'via', 'by', 'at', 'for', 'paid', 'sent',
    'received', 'debited', 'credited', 'txn', 'transaction', 'ref', 'reference',
    'number', 'bank', 'account', 'a', 'c', 'imps', 'neft', 'rtgs', 'card'
  ]);

  const tokens = normalizeText(description)
    .split(' ')
    .filter(Boolean)
    .filter(token => !stopwords.has(token))
    .filter(token => token.length >= 3)
    .filter(token => /[a-z]/.test(token));

  const uniqueTokens = [];
  for (const token of tokens) {
    if (!uniqueTokens.includes(token)) uniqueTokens.push(token);
  }

  return uniqueTokens.slice(0, 6).join(' ').trim();
}

function findBestMerchantRule(text, rules) {
  const key = merchantKeyFromDescription(text);
  if (!key) return null;

  let bestRule = null;
  let bestLength = 0;

  for (const rule of rules) {
    if (!rule?.pattern || !rule?.name) continue;
    if (key.includes(rule.pattern) || rule.pattern.includes(key)) {
      if (rule.pattern.length > bestLength) {
        bestRule = rule;
        bestLength = rule.pattern.length;
      }
    }
  }

  return bestRule?.name || null;
}

async function getMerchantRuleCategory(description, options = {}) {
  const key = merchantKeyFromDescription(description);
  if (!key) return null;

  if (Array.isArray(options.merchantRules)) {
    return findBestMerchantRule(key, options.merchantRules);
  }

  if (!process.env.DATABASE_URL) return null;

  try {
    const pool = require('../../db/pool');
    const { rows } = await pool.query(`
      SELECT mr.pattern, c.name
      FROM merchant_rules mr
      JOIN categories c ON mr.category_id = c.id
      ORDER BY LENGTH(mr.pattern) DESC, mr.updated_at DESC
    `);
    return findBestMerchantRule(key, rows);
  } catch (err) {
    return null;
  }
}

async function categorize(description, amount, type, options = {}) {
  const merchantRuleCategory = await getMerchantRuleCategory(description, options);
  if (merchantRuleCategory) return merchantRuleCategory;

  const ruleResult = ruleBasedCategory(description);
  if (ruleResult) return ruleResult;

  if (type === 'credit') return 'Others';
  return 'Others';
}

module.exports = {
  RULES,
  normalizeText,
  merchantKeyFromDescription,
  ruleBasedCategory,
  categorize
};
