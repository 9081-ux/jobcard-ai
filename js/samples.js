// samples.js — Three SAMPLE jobs (clearly labeled in the UI).
// Realistic field notes a technician might write; amounts are part of the
// fiction and are labeled SAMPLE so no one mistakes them for real invoices.

export const SAMPLE_JOBS = [
  {
    customer: 'Maria Lopez',
    address: '4821 Maple Ridge Dr, Austin, TX',
    trade: 'HVAC',
    text: `Replaced clogged air filter and cleaned evaporator coil.
Checked thermostat — reading 4 degrees off, recalibrated it.
Condensate drain was slow, flushed it clear.
Installed new capacitor $68.50, labor $120.
Customer asked about a whole-home humidifier, should send a quote next week.
Filter size 20x25x1, need to order 2 more for the truck.`,
  },
  {
    customer: 'James Whitfield',
    address: '77 Cedar Hollow Ln, Round Rock, TX',
    trade: 'Plumbing',
    text: `Kitchen faucet leaking at the base, replaced the cartridge and resealed with new gasket.
Bathroom toilet running nonstop — replaced fill valve $24.99.
Checked water pressure, 72 psi, fine.
Cleared slow drain in guest bath, no parts needed.
Homeowner wants the water heater flushed before winter, schedule a return visit in November.`,
  },
  {
    customer: 'Priya Natarajan',
    address: '1204 Bluebonnet St, Cedar Park, TX',
    trade: 'Electrical',
    text: `Replaced faulty GFCI outlet in the kitchen, tested OK.
Installed 2 new LED bulbs in the hallway $18.00 and a dimmer switch $32.50.
Breaker panel inspection — one breaker warm to the touch, recommend replacing the 20A breaker soon, not urgent but watch it.
Tightened loose wire nut in the living room ceiling fan.
Customer wants a quote for adding 2 outdoor outlets next spring.`,
  },
];
