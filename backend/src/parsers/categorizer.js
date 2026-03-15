const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Simple rule-based categorization first (fast, no API call)
const RULES = {
  Food:          ['swiggy', 'zomato', 'zepto', 'blinkit', 'dunzo', 'bigbasket', 'grofers', 'instamart', 'restaurant', 'cafe', 'hotel', 'dining', 'food', 'pizza', 'burger', 'dominos', 'mcdonalds', 'kfc', 'subway', 'starbucks'],
  Transport:     ['uber', 'ola', 'rapido', 'irctc', 'makemytrip', 'goibibo', 'cleartrip', 'metro', 'petrol', 'fuel', 'parking', 'toll', 'redbus', 'yatra'],
  Subscriptions: ['netflix', 'spotify', 'hotstar', 'prime', 'youtube', 'apple', 'microsoft', 'adobe', 'github', 'notion', 'figma', 'slack', 'zoom'],
  Shopping:      ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'snapdeal', 'shopclues', 'reliance', 'lifestyle', 'westside'],
  House:         ['rent', 'maintenance', 'electricity', 'bescom', 'wifi', 'airtel', 'jio', 'bsnl', 'water', 'gas', 'cook', 'maid', 'society'],
  Investments:   ['zerodha', 'groww', 'kuvera', 'coin', 'mutual fund', 'sip', 'nps', 'ppf', 'elss', 'fd ', 'fixed deposit'],
  Salary:        ['salary', 'payroll', 'stipend', 'ctc', 'employer']
};

function ruleBasedCategory(description) {
  const lower = (description || '').toLowerCase();
  for (const [category, keywords] of Object.entries(RULES)) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return null;
}

async function categorize(description, amount, type) {
  // Try rules first
  const ruleResult = ruleBasedCategory(description);
  if (ruleResult) return ruleResult;

  // Fall back to Claude API
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Categorize this Indian bank transaction into exactly one of: Food, Transport, Subscriptions, Shopping, House, Investments, Salary, Others.

Transaction: "${description}" Amount: ₹${amount} Type: ${type}

Reply with only the category name, nothing else.`
      }]
    });
    const category = response.content[0].text.trim();
    const valid = ['Food', 'Transport', 'Subscriptions', 'Shopping', 'House', 'Investments', 'Salary', 'Others'];
    return valid.includes(category) ? category : 'Others';
  } catch {
    return 'Others';
  }
}

module.exports = { categorize, ruleBasedCategory };
