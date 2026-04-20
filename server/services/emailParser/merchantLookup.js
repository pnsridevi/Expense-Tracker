/**
 * merchantLookup.js
 *
 * Keyword map from merchant names → { category, subCategory }.
 *
 * Previously this file exported lookupMerchant() which took an extracted
 * merchant name string and looked it up. In the loose parse approach,
 * extractor.js imports MERCHANT_MAP directly and scans the full email
 * body against all keywords — no merchant name extraction needed.
 *
 * MERCHANT_MAP is the single source of truth.
 * lookupMerchant() is kept as a utility in case it's useful elsewhere,
 * but extractor.js does not call it.
 *
 * Rules for adding entries:
 *   - keywords must be lowercase
 *   - category/subCategory must exactly match seeded DB values (case-insensitive
 *     comparison happens in classifier.js, but consistency is good practice)
 *   - More specific keywords first within each entry — first match wins
 *   - Avoid single common English words like "hotel" alone — too risky for
 *     false positives when scanning the full body
 */

export const MERCHANT_MAP = [

  // ── Food ────────────────────────────────────────────────────────────────────
  {
    keywords: ["swiggy"],
    category: "Food",
    subCategory: "Delivery",
  },
  {
    keywords: ["zomato"],
    category: "Food",
    subCategory: "Delivery",
  },
  {
    keywords: ["dunzo", "blinkit", "zepto", "bigbasket", "grofers", "jiomart"],
    category: "Food",
    subCategory: "Groceries",
  },
  {
    // Specific brand names before generic words like "restaurant"
    keywords: [
      "kfc", "mcdonalds", "mcdonald", "dominos", "domino's",
      "subway", "starbucks", "ccd", "cafe coffee day", "barista",
      "pizza hut", "burger king", "haldirams", "barbeque nation",
    ],
    category: "Food",
    subCategory: "Restaurant",
  },
  {
    // Generic food words — listed after specific brands to avoid false wins
    keywords: ["restaurant", "cafe", "dhaba", "bistro", "eatery", "pizza", "burger"],
    category: "Food",
    subCategory: "Restaurant",
  },

  // ── Travel ──────────────────────────────────────────────────────────────────
  {
    keywords: ["irctc", "indian railways", "indian rail"],
    category: "Travel",
    subCategory: "Train",
  },
  {
    keywords: [
      "indigo", "air india", "spicejet", "vistara", "akasa air",
      "goair", "go first", "airline", "airways",
    ],
    category: "Travel",
    subCategory: "Flight",
  },
  {
    keywords: ["ola cabs", "uber", "rapido", "meru cab"],
    category: "Travel",
    subCategory: "Cab",
  },
  {
    keywords: [
      "hp petrol", "indian oil", "iocl", "bharat petroleum",
      "bpcl", "hpcl", "reliance petro", "petrol pump",
    ],
    category: "Travel",
    subCategory: "Fuel",
  },
  {
    keywords: [
      "oyo rooms", "treebo", "fabhotel", "makemytrip hotel",
      "goibibo hotel", "taj hotels", "itc hotels", "marriott",
    ],
    category: "Travel",
    subCategory: "Hotel",
  },

  // ── Shopping ────────────────────────────────────────────────────────────────
  {
    keywords: ["amazon", "flipkart", "myntra", "ajio", "meesho", "snapdeal", "nykaa", "tatacliq"],
    category: "Shopping",
    subCategory: "General",
  },
  {
    keywords: [
      "croma", "reliance digital", "vijay sales",
      "samsung store", "apple store", "oneplus store", "mi store",
    ],
    category: "Shopping",
    subCategory: "Electronics",
  },
  {
    keywords: [
      "westside", "pantaloons", "max fashion", "h&m", "zara",
      "lifestyle store", "shoppers stop",
    ],
    category: "Shopping",
    subCategory: "Clothing",
  },

  // ── Utilities ───────────────────────────────────────────────────────────────
  {
    keywords: [
      "bescom", "tneb", "msedcl", "torrent power",
      "tata power", "electricity bill", "power bill",
    ],
    category: "Utilities",
    subCategory: "Electricity",
  },
  {
    // "airtel" and "jio" are also in internet — whichever entry appears
    // first in the map wins, so mobile recharge keywords are listed before
    // internet keywords for these brands.
    keywords: ["mobile recharge", "prepaid recharge", "postpaid bill", "vi recharge", "vodafone bill", "bsnl bill"],
    category: "Utilities",
    subCategory: "Mobile",
  },
  {
    keywords: [
      "act fibernet", "hathway", "you broadband",
      "jio fiber", "airtel fiber", "broadband bill", "internet bill",
    ],
    category: "Utilities",
    subCategory: "Internet",
  },
  {
    keywords: ["water board", "bwssb", "cmwssb", "water bill", "metro water"],
    category: "Utilities",
    subCategory: "Water",
  },

  // ── Medical ─────────────────────────────────────────────────────────────────
  {
    keywords: [
      "apollo pharmacy", "medplus", "netmeds", "pharmeasy",
      "1mg", "tata 1mg",
    ],
    category: "Medical",
    subCategory: "Pharmacy",
  },
  {
    keywords: [
      "apollo hospital", "fortis", "manipal hospital",
      "max hospital", "columbia asia", "kauvery", "vijaya hospital",
    ],
    category: "Medical",
    subCategory: "Hospital",
  },
  {
    keywords: [
      "star health", "hdfc ergo", "icici lombard", "bajaj allianz",
      "lic health", "niva bupa", "care health", "insurance premium",
    ],
    category: "Medical",
    subCategory: "Insurance",
  },

  // ── Entertainment ────────────────────────────────────────────────────────────
  {
    keywords: [
      "netflix", "prime video", "hotstar", "disney+", "sony liv",
      "zee5", "jiocinema", "mxplayer",
    ],
    category: "Entertainment",
    subCategory: "OTT",
  },
  {
    keywords: ["pvr", "inox", "cinepolis", "movie ticket", "bookmyshow"],
    category: "Entertainment",
    subCategory: "Movies",
  },
  {
    keywords: ["steam", "playstation", "xbox", "nintendo", "gaming"],
    category: "Entertainment",
    subCategory: "Games",
  },

  // ── Education ────────────────────────────────────────────────────────────────
  {
    keywords: [
      "udemy", "coursera", "byju", "unacademy", "upgrad",
      "skillshare", "edx", "simplilearn",
    ],
    category: "Education",
    subCategory: "Courses",
  },
  {
    keywords: ["school fee", "college fee", "tuition fee", "university fee", "exam fee"],
    category: "Education",
    subCategory: "Fees",
  },

  // ── Investment ───────────────────────────────────────────────────────────────
  {
    keywords: ["zerodha", "groww", "upstox", "kuvera", "coin by zerodha", "paytm money"],
    category: "Investment",
    subCategory: "Mutual Fund",
  },
  {
    keywords: ["sovereign gold bond", "sgb", "digital gold", "mmtc gold"],
    category: "Investment",
    subCategory: "Gold",
  },
  {
    keywords: ["fixed deposit", "fd booking", "term deposit"],
    category: "Investment",
    subCategory: "FD",
  },
  {
    keywords: ["equity", "nse", "bse", "stock purchase", "share purchase"],
    category: "Investment",
    subCategory: "Equity",
  },

  // ── Loans ────────────────────────────────────────────────────────────────────
  {
    keywords: ["home loan emi", "housing loan emi", "housing emi"],
    category: "Housing Loan",
    subCategory: "EMI",
  },
  {
    keywords: ["credit card emi", "cc emi", "card emi"],
    category: "Credit Card Loan",
    subCategory: "EMI",
  },
  {
    keywords: ["credit card outstanding", "card outstanding", "cc outstanding"],
    category: "Credit Card Loan",
    subCategory: "Outstanding",
  },
  {
    keywords: ["personal loan"],
    category: "Liability",
    subCategory: "Personal Loan",
  },

  // ── Salary / Income ──────────────────────────────────────────────────────────
  {
    keywords: ["salary credit", "sal credit", "payroll credit"],
    category: "Salary",
    subCategory: null,
  },
  {
    keywords: ["rental income", "rent received", "rent credit"],
    category: "Rental Income",
    subCategory: null,
  },
  {
    keywords: ["consulting fee", "freelance payment"],
    category: "Consulting Fee",
    subCategory: null,
  },

  // ── Dev/Test ─────────────────────────────────────────────────────────────────
  // Appears in confirmed HDFC debit card test email
  {
    keywords: ["anthropic"],
    category: "Education",
    subCategory: "Courses",
  },
  {
  keywords: ["society maintenance", "apartment maintenance", "maintenance charges"],
  category: "Housing Loan",
  subCategory: "Maintenance",
},
{
  keywords: ["kindle", "google play books", "crossword books"],
  category: "Education",
  subCategory: "Books",
},
{
  keywords: ["vehicle loan", "car loan emi", "two wheeler loan", "bike loan emi"],
  category: "Liability",
  subCategory: "Other Loan",
},
];

/**
 * Utility: look up a merchant name string against the map.
 * Not used by extractor.js in the loose parse approach, but kept
 * as a utility for any future use (e.g. manual transaction entry suggestions).
 *
 * @param {string|null} merchant
 * @returns {{ category: string, subCategory: string|null } | null}
 */
export function lookupMerchant(merchant) {
  if (!merchant) return null;
  const lower = merchant.toLowerCase();
  for (const entry of MERCHANT_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { category: entry.category, subCategory: entry.subCategory };
      }
    }
  }
  return null;
}
