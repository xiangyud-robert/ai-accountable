// Sample data, figures, icons and small chart helpers shared by the three mockups.
// The figures are worked out from the deals below, the way docs/spec.md defines them.
// "Today" is Sunday, Nov 22, 2026.
window.MOCK = (function () {
  const TODAY = '2026-11-22';

  const STAGES = [
    { key: 'new', name: 'New', prob: 10, open: true, color: '#118AB2', tint: '#D9ECF3' },
    { key: 'qualified', name: 'Qualified', prob: 25, open: true, color: '#FFC145', tint: '#FFF5E1' },
    { key: 'proposal', name: 'Proposal', prob: 50, open: true, color: '#F78C6B', tint: '#FEEDE7' },
    { key: 'negotiation', name: 'Negotiation', prob: 75, open: true, color: '#073B4C', tint: '#D7E0E2' },
    { key: 'won', name: 'Won', prob: 100, open: false, color: '#06D6A0', tint: '#D7F8F0' },
    { key: 'lost', name: 'Lost', prob: 0, open: false, color: '#8FA3A9', tint: '#EDF0F1' },
  ];
  const stageIndex = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

  // Each column top to bottom: [name, organization, main contact, value, close date, probability set by hand, stage lost from]
  const COLUMNS = {
    new: [
      ['Cobalt Bank fraud analytics pilot', 'Cobalt Bank', 'Daniel Okafor', 48000, '2027-02-12'],
      ['Fernhill Schools learning platform', 'Fernhill Schools', 'Grace Whitfield', 22500, '2027-01-29'],
      ['Larkspur Health patient portal discovery', 'Larkspur Health', 'Ruth Adeyemi', 9500, '2027-01-15'],
      ['Ridgeway Manufacturing shop floor dashboards', 'Ridgeway Manufacturing', 'Tomás Herrera', 36000, '2027-03-05'],
      ['Sable Hotels guest data integration', 'Sable Hotels', 'Aiko Tanaka', 15000, '2027-02-20'],
    ],
    qualified: [
      ['Harbor Logistics route planning add-on', 'Harbor Logistics', 'Priya Raman', 54000, '2027-01-08'],
      ['Quarry & Co finance reporting setup', 'Quarry & Co', 'Sam Whitaker', 12500, '2026-11-14'],
      ['Northwind Health staff scheduling', 'Northwind Health', 'Elena Petrova', 41500, '2026-12-30'],
      ['Brightline Retail loyalty data migration', 'Brightline Retail', 'Marcus Bell', 28000, '2026-12-18'],
      ['Tidewater Energy asset tracking pilot', 'Tidewater Energy', 'Leah Morgan', 33000, '2027-01-22'],
    ],
    proposal: [
      ['Meridian Insurance claims workflow integration', 'Meridian Insurance', 'Owen Fletcher', 95000, '2026-12-22', 60],
      ['Harbor Logistics fleet analytics', 'Harbor Logistics', 'Priya Raman', 72000, '2026-12-11'],
      ['Cobalt Bank data warehouse support', 'Cobalt Bank', 'Daniel Okafor', 26500, '2026-11-18'],
      ['Atlas Freight customs API integration', 'Atlas Freight', 'Ines Duarte', 44000, '2027-01-14'],
      ['Fernhill Schools staff training package', 'Fernhill Schools', 'Grace Whitfield', 8000, '2026-12-04'],
    ],
    negotiation: [
      ['Brightline Retail POS integration', 'Brightline Retail', 'Marcus Bell', 118000, '2026-12-09'],
      ['Northwind Health analytics rollout', 'Northwind Health', 'Elena Petrova', 57500, '2026-12-15'],
      ['Sable Hotels booking engine rollout', 'Sable Hotels', 'Aiko Tanaka', 64000, '2026-11-10'],
      ['Ridgeway Manufacturing support plan', 'Ridgeway Manufacturing', 'Tomás Herrera', 19500, '2026-11-30', 90],
    ],
    won: [
      ['Ridgeway Manufacturing quality analytics', 'Ridgeway Manufacturing', 'Tomás Herrera', 47500, '2026-11-17'],
      ['Cobalt Bank risk reporting licenses', 'Cobalt Bank', 'Daniel Okafor', 52500, '2026-10-29'],
      ['Brightline Retail e-commerce integration', 'Brightline Retail', 'Marcus Bell', 86000, '2026-10-08'],
      ['Fernhill Schools support renewal 2026', 'Fernhill Schools', 'Grace Whitfield', 22000, '2026-08-06'],
      ['Northwind Health data platform setup', 'Northwind Health', 'Elena Petrova', 51000, '2026-07-15'],
      ['Harbor Logistics dispatch platform', 'Harbor Logistics', 'Priya Raman', 96500, '2026-06-26'],
      ['Tidewater Energy field app licenses', 'Tidewater Energy', 'Leah Morgan', 35000, '2026-05-21'],
      ['Atlas Freight warehouse dashboards', 'Atlas Freight', 'Ines Duarte', 64000, '2026-04-09'],
      ['Quarry & Co payroll migration', 'Quarry & Co', 'Sam Whitaker', 27500, '2026-03-18'],
      ['Meridian Insurance policy portal licenses', 'Meridian Insurance', 'Owen Fletcher', 42000, '2026-01-27'],
      ['Larkspur Health records integration', 'Larkspur Health', 'Ruth Adeyemi', 18500, '2025-12-12'],
    ],
    lost: [
      ['Meridian Insurance agent mobile app', 'Meridian Insurance', 'Owen Fletcher', 140000, '2026-10-21', null, 'proposal'],
      ['Kestrel Media analytics training', 'Kestrel Media', 'Noah Brennan', 6500, '2026-09-11', null, 'new'],
      ['Pinecrest Foods inventory integration', 'Pinecrest Foods', 'Hannah Cole', 16500, '2026-07-02', null, 'qualified'],
      ['Kestrel Media content platform licenses', 'Kestrel Media', 'Noah Brennan', 75000, '2026-04-30', null, 'negotiation'],
      ['Sable Hotels revenue management pilot', 'Sable Hotels', 'Aiko Tanaka', 30000, '2026-02-24', null, 'proposal'],
    ],
  };

  const deals = [];
  for (const s of STAGES) {
    COLUMNS[s.key].forEach(([name, org, contact, value, close, prob, lostFrom], position) => {
      const p = prob ?? s.prob;
      deals.push({
        name, org, contact, value, close, position, stage: s.key, prob: p, open: s.open,
        lostFrom: lostFrom ?? null,
        expected: s.open ? Math.round((value * p) / 100) : 0,
        late: s.open && close < TODAY,
      });
    });
  }

  const sum = (xs, f) => xs.reduce((t, x) => t + f(x), 0);
  const open = deals.filter((d) => d.open);

  const byStage = STAGES.map((s) => {
    const ds = deals.filter((d) => d.stage === s.key);
    return { ...s, deals: ds, count: ds.length, value: sum(ds, (d) => d.value), expected: sum(ds, (d) => d.expected) };
  });

  // The last 12 calendar months, this one included.
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(2026, 10 - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const won = deals.filter((d) => d.stage === 'won' && d.close.startsWith(key));
    months.push({
      key,
      label: dt.toLocaleString('en-US', { month: 'short' }),
      long: dt.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      revenue: sum(won, (d) => d.value),
      count: won.length,
    });
  }

  // A deal counts in every stage up to the furthest one it reached (spec, concern 7).
  const furthest = (d) => (d.stage === 'lost' ? stageIndex[d.lostFrom] : stageIndex[d.stage]);
  const funnel = STAGES.slice(0, 5).map((s, i) => {
    const ds = deals.filter((d) => furthest(d) >= i);
    return { ...s, count: ds.length, value: sum(ds, (d) => d.value) };
  });
  funnel.forEach((f) => (f.share = Math.round((f.value / funnel[0].value) * 100)));

  const thisMonth = months[11];
  const lastMonth = months[10];
  const kpi = {
    revenueWon: thisMonth.revenue,
    revenueWonLast: lastMonth.revenue,
    dealsWon: thisMonth.count,
    dealsWonLast: lastMonth.count,
    openCount: open.length,
    openValue: sum(open, (d) => d.value),
    expected: sum(open, (d) => d.expected),
    wonYear: sum(months, (m) => m.revenue),
    wonYearCount: sum(months, (m) => m.count),
  };

  // [type, description, what it's on, due date]
  const followUps = [
    ['call', 'Chase the signed order form', 'Sable Hotels booking engine rollout', '2026-11-13'],
    ['email', 'Send revised pricing for a 3-year term', 'Quarry & Co finance reporting setup', '2026-11-16'],
    ['call', 'Confirm the data warehouse scope with IT', 'Daniel Okafor', '2026-11-18'],
    ['note', 'Prepare answers to the security questionnaire', 'Meridian Insurance claims workflow integration', '2026-11-20'],
    ['email', 'Share the education case study', 'Grace Whitfield', '2026-11-21'],
    ['call', 'Kick-off call to plan the pilot', 'Tidewater Energy asset tracking pilot', '2026-11-22'],
    ['email', 'Send the contract redlines', 'Brightline Retail POS integration', '2026-11-23'],
    ['call', 'Check the budget sign-off', 'Elena Petrova', '2026-11-24'],
    ['note', 'Draft the support plan quote', 'Ridgeway Manufacturing support plan', '2026-11-26'],
    ['call', 'Intro call with the operations lead', 'Aiko Tanaka', '2026-11-27'],
    ['email', 'Follow up on the demo', 'Atlas Freight customs API integration', '2026-11-29'],
  ].map(([type, text, on, due]) => {
    const days = daysBetween(TODAY, due);
    let label;
    if (days < 0) label = `${-days} ${days === -1 ? 'day' : 'days'} overdue`;
    else if (days === 0) label = 'Due today';
    else if (days === 1) label = 'Due tomorrow';
    else label = `Due in ${days} days`;
    return { type, text, on, due, days, overdue: days < 0, label };
  });

  const recent = [
    { kind: 'call', text: 'Walked through the fleet analytics proposal. Priya wants a phased rollout.', on: 'Harbor Logistics fleet analytics', when: 'Today, 9:40 AM' },
    { kind: 'stage', from: 'proposal', to: 'negotiation', on: 'Northwind Health analytics rollout', when: 'Yesterday, 4:15 PM' },
    { kind: 'email', text: 'Sent the POS integration contract draft to Marcus.', on: 'Brightline Retail POS integration', when: 'Yesterday, 11:02 AM' },
    { kind: 'note', text: 'Security review needed before sign-off.', on: 'Meridian Insurance claims workflow integration', when: 'Nov 20, 3:30 PM' },
    { kind: 'stage', from: 'qualified', to: 'proposal', on: 'Atlas Freight customs API integration', when: 'Nov 19, 2:10 PM' },
    { kind: 'call', text: 'Support plan looks likely. Asked for a 2-year option.', on: 'Tomás Herrera', when: 'Nov 18, 10:00 AM' },
    { kind: 'stage', from: 'negotiation', to: 'won', on: 'Ridgeway Manufacturing quality analytics', when: 'Nov 17, 5:20 PM' },
    { kind: 'status', text: 'Became a customer when Ridgeway Manufacturing quality analytics was won', on: 'Tomás Herrera', when: 'Nov 17, 5:20 PM' },
    { kind: 'added', to: 'new', on: 'Larkspur Health patient portal discovery', when: 'Nov 16, 1:45 PM' },
    { kind: 'email', text: 'Asked for revised pricing on a 3-year term.', on: 'Sam Whitaker', when: 'Nov 14, 11:30 AM' },
  ];
  const stageName = (key) => STAGES[stageIndex[key]].name;
  recent.forEach((r) => {
    if (r.kind === 'stage') r.text = `Moved from ${stageName(r.from)} to ${stageName(r.to)}`;
    if (r.kind === 'added') r.text = `Added at ${stageName(r.to)}`;
  });

  function daysBetween(a, b) {
    const [ya, ma, da] = a.split('-').map(Number);
    const [yb, mb, db] = b.split('-').map(Number);
    return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
  }

  // Formats

  const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
  function usdShort(n) {
    if (n >= 1e6) return '$' + trim((n / 1e6).toFixed(n >= 1e7 ? 0 : 1)) + 'M';
    if (n >= 1e3) return '$' + trim((n / 1e3).toFixed(n >= 1e5 ? 0 : 1)) + 'K';
    return '$' + n;
  }
  const trim = (s) => s.replace(/\.0$/, '');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateLong(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  }
  function dateShort(iso) {
    const [, m, d] = iso.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
  }
  // The year is left out when it's this year, as in the spec's timelines.
  const dateSmart = (iso) => (iso.startsWith('2026') ? dateShort(iso) : dateLong(iso));
  const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('');

  // Icons, drawn the way lucide-react draws them (24 by 24, 2px strokes)

  const ICONS = {
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    organizations: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    contacts: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    deals: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    pipeline: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/>',
    call: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    email: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    note: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    stage: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    added: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    status: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  };
  const icon = (name, size = 18) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  // Only the dashboard and the pipeline are mocked up. Their links scroll to that screen on the page.
  const SCREENS = { dashboard: '#dashboard', pipeline: '#pipeline' };
  const linkTo = (key) =>
    SCREENS[key] ? `href="${SCREENS[key]}"` : 'aria-disabled="true" title="Not part of this mockup"';

  const NAV = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'organizations', label: 'Organizations' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'deals', label: 'Deals' },
    { key: 'pipeline', label: 'Pipeline' },
  ];

  // Charts, as SVG strings. Text uses the .tick and .val classes from shared.css, never the series color.

  function roundedTop(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  // A line over a flat wash, with the peak and the latest month labelled.
  function lineChart({ points, width, height, color, wash, yMax, yStep, label }) {
    const pad = { top: 28, right: 64, bottom: 30, left: 52 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    const x = (i) => pad.left + (i * w) / (points.length - 1);
    const y = (v) => pad.top + h - (v / yMax) * h;
    let s = `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${label}">`;
    for (let v = 0; v <= yMax; v += yStep) {
      s += `<line x1="${pad.left}" x2="${width - pad.right + 8}" y1="${y(v)}" y2="${y(v)}" stroke="#E3EAEC" stroke-width="1"/>`;
      s += `<text class="tick" x="${pad.left - 12}" y="${y(v) + 4}" text-anchor="end">${usdShort(v)}</text>`;
    }
    points.forEach((p, i) => {
      s += `<text class="tick" x="${x(i)}" y="${height - 8}" text-anchor="middle">${p.label}</text>`;
    });
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
    s += `<path d="${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="${wash}"/>`;
    s += `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const peak = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0);
    const last = points.length - 1;
    for (const i of new Set([peak, last])) {
      s += `<circle cx="${x(i)}" cy="${y(points[i].value)}" r="5" fill="${color}" stroke="#fff" stroke-width="2"/>`;
      const side = i === last ? `x="${x(i) + 12}" y="${y(points[i].value) + 4}" text-anchor="start"` : `x="${x(i)}" y="${y(points[i].value) - 12}" text-anchor="middle"`;
      s += `<text class="val" ${side}>${usdShort(points[i].value)}</text>`;
    }
    points.forEach((p, i) => {
      const bw = w / (points.length - 1);
      s += `<rect x="${x(i) - bw / 2}" y="${pad.top}" width="${bw}" height="${h}" fill="transparent"><title>${p.long}: ${usd(p.value)} won</title></rect>`;
    });
    return s + '</svg>';
  }

  // Columns with 4px rounded tops and the count on each cap.
  function barChart({ points, width, height, color, yMax, barWidth = 18, label }) {
    const pad = { top: 24, right: 8, bottom: 30, left: 8 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    const band = w / points.length;
    const base = pad.top + h;
    let s = `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${label}">`;
    s += `<line x1="${pad.left}" x2="${width - pad.right}" y1="${base + 0.5}" y2="${base + 0.5}" stroke="#E3EAEC"/>`;
    points.forEach((p, i) => {
      const cx = pad.left + band * i + band / 2;
      const bh = (p.value / yMax) * h;
      if (p.value > 0) s += `<path d="${roundedTop(cx - barWidth / 2, base - bh, barWidth, bh, 4)}" fill="${color}"/>`;
      s += `<text class="val" x="${cx}" y="${base - bh - 8}" text-anchor="middle">${p.value}</text>`;
      s += `<text class="tick" x="${cx}" y="${height - 8}" text-anchor="middle">${p.label}</text>`;
      s += `<rect x="${cx - band / 2}" y="${pad.top}" width="${band}" height="${h}" fill="transparent"><title>${p.long}: ${p.value} ${p.value === 1 ? 'deal' : 'deals'} won</title></rect>`;
    });
    return s + '</svg>';
  }

  return {
    TODAY, STAGES, stageIndex, stageName, deals, byStage, months, funnel, kpi, followUps, recent, NAV,
    linkTo, usd, usdShort, dateLong, dateShort, dateSmart, initials, icon, lineChart, barChart,
    stage: (key) => STAGES[stageIndex[key]],
  };
})();
