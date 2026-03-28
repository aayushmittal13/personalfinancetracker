const RULES = {
  Food: [
    'swiggy', 'zomato', 'zepto', 'blinkit', 'dunzo', 'bigbasket', 'grofers',
    'instamart', 'restaurant', 'cafe', 'hotel', 'dining', 'food', 'pizza',
    'burger', 'dominos', 'mcdonalds', 'kfc', 'subway', 'starbucks',
    'chaayos', 'haldiram', 'barbeque nation', 'biryani', 'bakery', 'cake',
    'sweet', 'mithai', 'ice cream', 'baskin', 'naturals', 'dosa', 'idli',
    'thali', 'meal', 'lunch', 'dinner', 'breakfast', 'snack', 'chai',
    'tea', 'coffee', 'juice', 'smoothie', 'milkshake', 'licious', 'freshmenu',
    'faasos', 'behrouz', 'eatfit', 'box8', 'rebel foods', 'eat sure',
    'dmart', 'more megastore', 'reliance fresh', 'spencer', 'star bazaar',
    'grocery', 'vegetables', 'fruits', 'milk', 'bread', 'atta', 'dal',
    'rice', 'oil', 'masala', 'spice', 'paneer', 'chicken', 'mutton',
    'egg', 'curd', 'butter', 'cheese', 'noodles', 'maggi', 'chips',
    'biscuit', 'chocolate', 'candy', 'soft drink', 'cola', 'pepsi',
    'coca cola', 'thumbs up', 'sprite', 'fanta', 'limca', 'frooti',
    'maaza', 'appy', 'real juice', 'paper boat', 'country delight',
    'jiomart', 'bb daily', 'milkbasket', 'supr daily',
    'ccd', 'cafe coffee day', 'barista', 'third wave', 'blue tokai',
    'eatclub', 'eatsure', 'wat-a-burger', 'burger king', 'wendy',
    'taco bell', 'pizza hut', 'papa johns', 'ovenstory',
    'mojo pizza', 'la pino', 'chicago pizza', 'wow momo',
    'chicking', 'popeyes', 'mad over donuts', 'krispy kreme',
    'sagar ratna', 'saravana bhavan', 'udupi', 'vaango',
    'pind balluchi', 'punjabi', 'mughlai', 'chinese',
    'nandos', 'chilis', 'tgif', 'social', 'imperfecto',
    'bira', 'kingfisher', 'tuborg', 'heineken', 'budweiser',
    'whiskey', 'rum', 'vodka', 'gin', 'wine', 'beer', 'bar', 'pub',
    'liquor', 'alcohol', 'daru', 'theka', 'ahata'
  ],
  Transport: [
    'uber', 'ola', 'rapido', 'irctc', 'makemytrip', 'goibibo', 'cleartrip',
    'metro', 'petrol', 'fuel', 'parking', 'toll', 'redbus', 'yatra',
    'indigo', 'air india', 'spicejet', 'vistara', 'akasa', 'go first',
    'flybus', 'easemytrip', 'ixigo', 'trainman', 'confirmtkt',
    'paytm travel', 'mmt', 'oyo', 'fab hotel', 'treebo', 'zostel',
    'hostel', 'airbnb', 'booking.com', 'agoda', 'trivago',
    'namma yatri', 'blueair', 'meru', 'savaari',
    'cab', 'taxi', 'auto', 'rickshaw', 'bike taxi',
    'bus', 'train', 'flight', 'airline', 'airport',
    'diesel', 'cng', 'ev charging', 'fastag', 'iocl',
    'hp petrol', 'bharat petroleum', 'bpcl', 'hpcl', 'shell',
    'indian oil', 'reliance petrol', 'nayara',
    'servic', 'mechanic', 'puncture', 'tyre', 'tire',
    'car wash', 'insurance vehicle', 'challan', 'fine traffic',
    'ksrtc', 'tsrtc', 'apsrtc', 'bmtc', 'best bus', 'dtc',
    'zoomcar', 'drivezy', 'revv', 'bounce', 'vogo', 'yulu',
    'rental car', 'self drive'
  ],
  Subscriptions: [
    'netflix', 'spotify', 'hotstar', 'prime', 'youtube', 'apple', 'microsoft',
    'adobe', 'github', 'notion', 'figma', 'slack', 'zoom',
    'disney', 'jio cinema', 'sonyliv', 'zee5', 'voot', 'mubi',
    'alt balaji', 'ullu', 'aha', 'hoichoi', 'eros now',
    'amazon prime', 'prime video', 'audible', 'kindle unlimited',
    'google one', 'icloud', 'dropbox', 'evernote', 'todoist',
    'canva', 'grammarly', 'chatgpt', 'openai', 'anthropic', 'claude',
    'linkedin premium', 'medium', 'substack', 'patreon',
    'newspaper', 'times', 'hindu', 'economic times', 'mint',
    'subscription', 'renewal', 'membership', 'annual plan', 'monthly plan',
    'hbo', 'paramount', 'peacock', 'crunchyroll',
    'playstation', 'xbox', 'nintendo', 'steam', 'epic games',
    'vpn', 'nordvpn', 'expressvpn', 'surfshark',
    'coursera', 'udemy', 'skillshare', 'masterclass', 'unacademy',
    'byjus', 'vedantu', 'toppr', 'whitehat', 'coding ninjas',
    'codeforces', 'leetcode', 'hackerrank',
    'headspace', 'calm', 'strava', 'fitbit',
    'wynk', 'gaana', 'jiosaavn', 'apple music', 'tidal', 'deezer'
  ],
  Shopping: [
    'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'snapdeal',
    'shopclues', 'reliance', 'lifestyle', 'westside',
    'tata cliq', 'croma', 'vijay sales', 'reliance digital',
    'decathlon', 'nike', 'adidas', 'puma', 'reebok', 'fila',
    'h&m', 'zara', 'uniqlo', 'levis', 'wrangler', 'pepe jeans',
    'pantaloons', 'max fashion', 'fbb', 'central', 'shoppers stop',
    'brand factory', 'v-mart', 'big bazaar', 'easyday',
    'lenskart', 'firstcry', 'mamaearth', 'wow', 'plum', 'sugar cosmetics',
    'purplle', 'tresemme', 'loreal', 'lakme',
    'boat', 'noise', 'fire-boltt', 'oneplus', 'samsung', 'xiaomi',
    'apple store', 'iphone', 'macbook', 'ipad',
    'ikea', 'pepperfry', 'urban ladder', 'hometown', 'godrej interio',
    'amazon fresh', 'grofers', 'jiomart',
    'fabindia', 'biba', 'w', 'global desi', 'AND', 'aurelia',
    'mango', 'forever 21', 'marks & spencer', 'gap',
    'bewakoof', 'the souled store', 'bonkers corner',
    'chumbak', 'nush', 'rare rabbit',
    'titan', 'fastrack', 'sonata', 'casio', 'fossil',
    'tanishq', 'malabar', 'kalyan', 'senco', 'pc jeweller',
    'jewellery', 'jewelry', 'gold', 'silver', 'diamond',
    'gift', 'present', 'bouquet', 'flower', 'ferns n petals', 'fnp',
    'archies', 'hallmark',
    'toy', 'game', 'puzzle', 'book', 'stationery',
    'crossword', 'landmark', 'om book shop'
  ],
  House: [
    'rent', 'maintenance', 'electricity', 'bescom', 'wifi', 'airtel', 'jio',
    'bsnl', 'water', 'gas', 'cook', 'maid', 'society',
    'broadband', 'internet', 'fiber', 'act fibernet', 'hathway', 'tikona',
    'tata sky', 'dish tv', 'sun direct', 'd2h', 'cable',
    'indane', 'hp gas', 'bharat gas', 'lpg', 'piped gas',
    'mseb', 'tata power', 'adani electricity', 'reliance energy',
    'water bill', 'water tax', 'property tax',
    'house keeping', 'cleaning', 'laundry', 'dry clean', 'iron',
    'pest control', 'plumber', 'electrician', 'carpenter',
    'painting', 'repair', 'renovation',
    'furniture', 'mattress', 'pillow', 'bedsheet', 'curtain',
    'kitchen', 'utensil', 'appliance', 'mixer', 'grinder',
    'washing machine', 'refrigerator', 'fridge', 'ac', 'fan', 'geyser',
    'water purifier', 'ro', 'aquaguard', 'kent',
    'security deposit', 'brokerage', 'agreement',
    'society maintenance', 'apartment', 'flat',
    'garbage', 'waste', 'municipal', 'nagar palika',
    'housing loan', 'home loan', 'emi house',
    'vi ', 'vodafone', 'idea', 'postpaid', 'prepaid', 'recharge',
    'mobile bill', 'phone bill'
  ],
  Investments: [
    'zerodha', 'groww', 'kuvera', 'coin', 'mutual fund', 'sip', 'nps',
    'ppf', 'elss', 'fd ', 'fixed deposit',
    'upstox', 'angel one', 'angel broking', '5paisa', 'paytm money',
    'iifl', 'motilal oswal', 'hdfc securities', 'icici direct',
    'kotak securities', 'axis direct', 'geojit',
    'smallcase', 'scripbox', 'et money', 'niyo',
    'nifty', 'sensex', 'bse', 'nse', 'sebi',
    'stock', 'share', 'equity', 'debenture', 'bond',
    'gold bond', 'sgb', 'sovereign', 'bullion',
    'lump sum', 'systematic', 'index fund', 'debt fund',
    'liquid fund', 'overnight fund', 'gilt',
    'lic ', 'lic premium', 'term plan', 'endowment',
    'health insurance', 'life insurance', 'term insurance',
    'ulip', 'pension', 'annuity', 'retirement',
    'crypto', 'bitcoin', 'ethereum', 'wazirx', 'coinswitch',
    'coindcx', 'zebpay',
    'digital gold', 'sovereign gold', 'gold etf',
    'recurring deposit', 'rd ', 'savings scheme',
    'post office', 'nsc', 'kvp', 'sukanya samriddhi',
    'dividend', 'interest earned', 'capital gain',
    'mf ', 'amc', 'folio', 'nav', 'units'
  ],
  Salary: [
    'salary', 'payroll', 'stipend', 'ctc', 'employer',
    'wages', 'remuneration', 'compensation', 'bonus', 'incentive',
    'commission', 'freelance payment', 'consulting fee',
    'arrears', 'gratuity', 'provident fund credit',
    'neft salary', 'imps salary', 'monthly credit'
  ],
  Health: [
    'hospital', 'doctor', 'clinic', 'medical', 'medicine', 'pharmacy',
    'chemist', 'apollo', 'fortis', 'max hospital', 'medanta', 'narayana',
    'manipal', 'aiims', 'practo', 'pharmeasy', 'netmeds', '1mg',
    'tata 1mg', 'medplus', 'wellness forever',
    'dentist', 'dental', 'eye', 'optician', 'lens',
    'diagnostic', 'pathology', 'lab test', 'blood test', 'xray', 'mri',
    'ct scan', 'thyrocare', 'lal path', 'dr lal', 'srl',
    'gym', 'fitness', 'yoga', 'crossfit', 'cult fit', 'cultfit',
    'gold gym', 'anytime fitness', 'fitness first',
    'physiotherapy', 'therapy', 'counselling', 'psychologist',
    'ayurveda', 'homeopathy', 'naturopathy',
    'health checkup', 'annual checkup', 'vaccination', 'vaccine',
    'prescription', 'consultation', 'opd', 'ipd',
    'ambulance', 'emergency', 'icu',
    'health insurance premium', 'mediclaim'
  ]
};

function ruleBasedCategory(description) {
  const lower = (description || '').toLowerCase();
  for (const [category, keywords] of Object.entries(RULES)) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return null;
}

async function categorize(description, amount, type) {
  const ruleResult = ruleBasedCategory(description);
  if (ruleResult) return ruleResult;

  if (type === 'credit' && amount >= 15000) return 'Salary';
  if (type === 'credit') return 'Others';

  return 'Others';
}

module.exports = { categorize, ruleBasedCategory };
