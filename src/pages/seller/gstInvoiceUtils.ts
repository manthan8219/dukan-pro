/** Helpers for Indian GST invoice formatting (CBIC-style fields). */

/** State / UT code → name (for display from GSTIN or POS code). */
export const GST_STATE_CODE_NAME: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export function stateNameFromCode(code: string): string | null {
  const c = code.trim().padStart(2, '0').slice(0, 2);
  return GST_STATE_CODE_NAME[c] ?? null;
}

/** For POS / dropdowns — sorted by state code. */
export function gstStateCodeOptions(): { code: string; name: string }[] {
  return Object.entries(GST_STATE_CODE_NAME)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** PAN is embedded at positions 3–12 of a 15-char GSTIN (1-based). */
export function panFromGstin(gstin: string): string | null {
  const g = gstin.trim().toUpperCase().replace(/\s/g, '');
  if (g.length < 12) return null;
  return g.slice(2, 12);
}

export function stateCodeFromGstin(gstin: string): string | null {
  const g = gstin.trim().toUpperCase();
  if (g.length < 2) return null;
  return g.slice(0, 2);
}

const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function wordsBelowThousand(n: number): string {
  if (n < 20) return ones[n] ?? '';
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return tens[t] + (o ? ` ${ones[o]}` : '');
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${ones[h]} Hundred${rest ? ` and ${wordsBelowThousand(rest)}` : ''}`;
}

/** Indian numbering: Crores, Lakhs, Thousands. */
export function rupeesToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return 'Invalid amount';
  const paise = Math.round((amount % 1) * 100);
  const intPart = Math.floor(amount);
  let rupees = intPart;
  if (intPart === 0 && paise === 0) return 'Zero Rupees only';
  if (intPart === 0 && paise > 0) {
    return `${wordsBelowThousand(paise)} Paise only`;
  }

  const parts: string[] = [];

  const crores = Math.floor(rupees / 10000000);
  rupees %= 10000000;
  const lakhs = Math.floor(rupees / 100000);
  rupees %= 100000;
  const thousands = Math.floor(rupees / 1000);
  rupees %= 1000;

  if (crores) parts.push(`${wordsBelowThousand(crores)} Crore`);
  if (lakhs) parts.push(`${wordsBelowThousand(lakhs)} Lakh`);
  if (thousands) parts.push(`${wordsBelowThousand(thousands)} Thousand`);
  if (rupees) parts.push(wordsBelowThousand(rupees));

  let out = parts.join(' ').replace(/\s+/g, ' ').trim();
  const intOnlyRupee = paise === 0 && intPart === 1;
  out += intOnlyRupee ? ' Rupee' : ' Rupees';
  if (paise > 0) {
    out += ` and ${wordsBelowThousand(paise)} Paise`;
  }
  out += ' only';
  return out;
}
