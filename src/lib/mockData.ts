import type { AnomalyType, Project, RiskDriver } from './types';

const STATES = [
  ['Maharashtra', ['Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Kolhapur']],
  ['Uttar Pradesh', ['Varanasi', 'Lucknow', 'Kanpur', 'Prayagraj', 'Agra']],
  ['Tamil Nadu', ['Chennai', 'Madurai', 'Coimbatore', 'Salem', 'Tiruchirappalli']],
  ['Karnataka', ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi']],
  ['Rajasthan', ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer']],
  ['Bihar', ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga']],
  ['West Bengal', ['Kolkata', 'Siliguri', 'Durgapur', 'Howrah', 'Malda']],
  ['Odisha', ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Sambalpur']],
] as const;

const WORKS = [
  'Construction of rural link road and drainage system',
  'Renovation of government primary health centre',
  'Solar street lighting for public spaces',
  'Construction of community learning and skill centre',
  'Drinking water pipeline and elevated storage tank',
  'Upgradation of government school science laboratory',
  'Construction of pedestrian bridge over local stream',
  'Installation of digital classroom and library equipment',
  'Construction of covered market and public sanitation block',
  'Restoration of village irrigation and check dam network',
];

const VENDORS = [
  'Sahyadri Infrastructure Ltd',
  'Purvanchal Contractors Pvt Ltd',
  'Apex Tech Solutions',
  'Vidarbha Rural Works Cooperative',
  'Dakshin Bharat Engineering',
  'Ganga Buildcon Services',
  'Bharat Solar Systems',
  'Konkan Civil Projects',
  'Eastern District Works Agency',
  'Jan Seva Construction Group',
];

const HIGH_FLAGS = ['Cost Inflation 32%', 'Duplicate Scope', 'Cost Outlier', 'Spatial Overlap'];
const MODERATE_FLAGS = ['Milestone Delayed >120 days', 'Documentation Gap', 'Vendor Concentration Review', 'Timeline Review'];

function driver(label: string, note: string, score: number): RiskDriver {
  return { key: label.includes('Vendor') ? 'vendor' : label.includes('Cost') ? 'budget' : 'location', label, note, score, weight: 0.33 };
}

/** Deterministic 240-record demo dataset: 120 Lok Sabha + 120 Rajya Sabha.
 * Tiers are explicit: 60 high, 70 moderate, 110 low. It is only used when
 * Supabase is unavailable, never mixed into a successful live query. */
export function buildMockProjects(): Project[] {
  return Array.from({ length: 240 }, (_, index) => {
    const stateEntry = STATES[index % STATES.length];
    const state = stateEntry[0];
    const district = stateEntry[1][Math.floor(index / STATES.length) % stateEntry[1].length];
    const house = index % 2 === 0 ? 'Lok Sabha' : 'Rajya Sabha';
    const tier = index < 60 ? 'high' : index < 130 ? 'moderate' : 'low';
    const risk = tier === 'high' ? 76 + (index % 25) : tier === 'moderate' ? 40 + (index % 36) : index % 38;
    const flag = tier === 'high' ? HIGH_FLAGS[index % HIGH_FLAGS.length] : tier === 'moderate' ? MODERATE_FLAGS[index % MODERATE_FLAGS.length] : 'Normal';
    const amount = 200000 + ((index * 1373317) % 48_000_000);
    const status = index % 5 === 0 ? 'Completed' : index % 3 === 0 ? 'In-Progress' : 'Sanctioned';
    const anomaly: AnomalyType = tier === 'high' ? (index % 2 ? 'Split Tendering' : 'Duplicate Location') : tier === 'moderate' ? 'Normal' : 'Normal';
    return {
      id: index + 1,
      house,
      sr_no: String(index + 1),
      state,
      category: index % 3 === 0 ? 'Infrastructure' : index % 3 === 1 ? 'Health & Education' : 'Civic Amenities',
      work: WORKS[index % WORKS.length],
      work_id: `DEMO/${state.slice(0, 3).toUpperCase()}/${2025 + (index % 2)}/${String(index + 1).padStart(5, '0')}`,
      ida: `${district} District Planning Office`,
      mp: `${['Asha Patil', 'Ravi Kumar', 'Meena Das', 'Arjun Singh', 'Kavita Rao'][index % 5]}`,
      constituency: `${district} ${index % 2 ? 'PC' : 'North'}`,
      expenditure_date: `202${5 + (index % 2)}-${String((index % 9) + 1).padStart(2, '0')}-15`,
      vendor_name: VENDORS[index % VENDORS.length],
      payment_status: status,
      status,
      stage: status,
      latitude: 16 + ((index * 0.19) % 20),
      longitude: 73 + ((index * 0.31) % 22),
      amount,
      allocated_amount: amount * 1.15,
      sanctioned_amount: amount,
      risk_score: risk,
      anomaly_type: anomaly,
      risk_drivers: tier === 'low' ? [] : [driver(flag, flag, risk)],
      approval_status: status === 'Sanctioned' ? 'Approved' : status,
      delay_days: tier === 'moderate' ? 120 + (index % 45) : tier === 'high' ? 180 + (index % 90) : null,
      completion_percent: status === 'Completed' ? 100 : status === 'In-Progress' ? 55 : 10,
    };
  });
}
