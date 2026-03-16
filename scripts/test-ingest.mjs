import { computeOtRelevanceScore } from '../src/lib/signals/ot-relevance.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseUpsert(signals) {
  const rows = signals.map(s => ({
    id: s.id,
    source: s.source,
    source_id: s.sourceId,
    timestamp: s.timestamp,
    entity: s.entity,
    sector: s.sector,
    signal_type: s.signalType,
    location: s.location,
    value: s.value,
    description: s.description.slice(0, 4000),
    url: s.url,
    ot_relevance_score: s.otRelevanceScore,
    ot_keywords: s.otKeywords,
    raw_data: s.rawData,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Upsert error:', res.status, text);
    } else {
      console.log(`Upserted batch ${i}-${i+batch.length}`);
    }
  }
}

// Fetch Federal Register
async function fetchFederalRegister() {
  const terms = ['SCADA', 'industrial control', 'critical infrastructure', 'cybersecurity', 'operational technology', 'pipeline safety', 'chemical facility', 'nuclear', 'manufacturing', 'water treatment', 'electric grid', 'NERC CIP'];
  const signals = [];
  const seen = new Set();

  for (const term of terms) {
    try {
      const params = new URLSearchParams({
        'conditions[term]': term,
        'conditions[publication_date][gte]': daysAgo(90),
        per_page: '20',
        order: 'newest',
      });
      const res = await fetch(`https://www.federalregister.gov/api/v1/documents.json?${params}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const doc of (data.results || [])) {
        const id = `federal-register-${doc.document_number}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const agencies = (doc.agencies || []).map(a => a.name || a.raw_name);
        const text = [doc.abstract, doc.title, ...agencies].filter(Boolean).join(' ');
        const { score, keywords } = computeOtRelevanceScore(text);
        signals.push({
          id, source: 'federal-register', sourceId: doc.document_number,
          timestamp: new Date(doc.publication_date).toISOString(),
          entity: agencies[0] || 'Federal Government', sector: 'manufacturing',
          signalType: 'regulatory-action', location: 'United States', value: 0,
          description: (doc.abstract || doc.title).slice(0, 2000),
          url: doc.html_url, otRelevanceScore: score, otKeywords: keywords,
          rawData: { type: doc.type, agencies, document_number: doc.document_number },
        });
      }
    } catch (e) { console.error('FR term error:', term, e.message); }
  }
  return signals;
}

// Fetch USASpending
async function fetchUSASpending() {
  const signals = [];
  const naicsCodes = ['541512','541513','541519','334111','334118','334290','335999','333914'];
  try {
    const body = {
      filters: {
        time_period: [{ start_date: daysAgo(180), end_date: new Date().toISOString().split('T')[0] }],
        naics_codes: naicsCodes,
        award_type_codes: ['A','B','C','D'],
      },
      fields: ['Award ID','Recipient Name','Award Amount','Description','Award Type','Awarding Agency','Start Date','Place of Performance State Code','Place of Performance City Name','NAICS','generated_internal_id'],
      limit: 100, page: 1, sort: 'Award Amount', order: 'desc',
    };
    const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      for (const a of (data.results || [])) {
        const desc = a.Description || `${a['Award Type']} to ${a['Recipient Name']}`;
        const text = [desc, a['Recipient Name'], a['Awarding Agency'], a.NAICS].filter(Boolean).join(' ');
        const { score, keywords } = computeOtRelevanceScore(text);
        const state = a['Place of Performance State Code'] || '';
        const city = a['Place of Performance City Name'] || '';
        signals.push({
          id: `usaspending-${a.generated_internal_id || a['Award ID']}`,
          source: 'usaspending', sourceId: a['Award ID'] || a.generated_internal_id,
          timestamp: new Date(a['Start Date']).toISOString(),
          entity: a['Recipient Name'] || 'Unknown', sector: 'manufacturing',
          signalType: 'contract-award',
          location: city && state ? `${city}, ${state}` : state || 'United States',
          value: Math.round(a['Award Amount'] || 0),
          description: desc.slice(0, 2000),
          url: `https://www.usaspending.gov/award/${a.generated_internal_id}`,
          otRelevanceScore: score, otKeywords: keywords,
          rawData: { award_type: a['Award Type'], agency: a['Awarding Agency'], naics: a.NAICS },
        });
      }
    }
  } catch (e) { console.error('USASpending error:', e.message); }

  // Keyword search
  for (const kw of ['SCADA', 'cybersecurity', 'industrial control', 'operational technology', 'automation']) {
    try {
      const body = {
        filters: {
          time_period: [{ start_date: daysAgo(90), end_date: new Date().toISOString().split('T')[0] }],
          keyword: kw, award_type_codes: ['A','B','C','D'],
        },
        fields: ['Award ID','Recipient Name','Award Amount','Description','Award Type','Awarding Agency','Start Date','Place of Performance State Code','NAICS','generated_internal_id'],
        limit: 25, page: 1, sort: 'Award Amount', order: 'desc',
      };
      const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const a of (data.results || [])) {
        const id = `usaspending-${a.generated_internal_id || a['Award ID']}`;
        if (signals.some(s => s.id === id)) continue;
        const desc = a.Description || `${a['Award Type']} to ${a['Recipient Name']}`;
        const text = [desc, a['Recipient Name'], a['Awarding Agency']].filter(Boolean).join(' ');
        const { score, keywords } = computeOtRelevanceScore(text);
        signals.push({
          id, source: 'usaspending', sourceId: a['Award ID'] || a.generated_internal_id,
          timestamp: new Date(a['Start Date']).toISOString(),
          entity: a['Recipient Name'] || 'Unknown', sector: 'manufacturing',
          signalType: 'contract-award',
          location: a['Place of Performance State Code'] || 'United States',
          value: Math.round(a['Award Amount'] || 0),
          description: desc.slice(0, 2000),
          url: `https://www.usaspending.gov/award/${a.generated_internal_id}`,
          otRelevanceScore: score, otKeywords: keywords,
          rawData: { award_type: a['Award Type'], agency: a['Awarding Agency'], keyword_match: kw },
        });
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) { console.error('USASpending kw error:', kw, e.message); }
  }
  return signals;
}

// Fetch SEC EDGAR
async function fetchSecEdgar() {
  const signals = [];
  const queries = ['SCADA cybersecurity', 'industrial control systems', 'operational technology', 'OT cybersecurity', 'critical infrastructure cyber'];
  for (const q of queries) {
    try {
      const params = new URLSearchParams({
        q, dateRange: 'custom', startdt: daysAgo(180), enddt: new Date().toISOString().split('T')[0],
        forms: '10-K,10-Q,8-K',
      });
      const res = await fetch(`https://efts.sec.gov/LATEST/search-index?${params}`, {
        headers: { 'User-Agent': 'OTRadar/1.0 contact@aibaseload.com', Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const hit of (data.hits?.hits || []).slice(0, 15)) {
        const doc = hit._source;
        const id = `sec-edgar-${doc.id || hit._id}`;
        if (signals.some(s => s.id === id)) continue;
        const highlights = Object.values(doc._highlights || {}).flat().join(' ').replace(/<[^>]+>/g, '');
        const text = [highlights, doc.file_description, doc.entity_name].filter(Boolean).join(' ');
        const { score, keywords } = computeOtRelevanceScore(text);
        signals.push({
          id, source: 'sec-edgar', sourceId: doc.id || hit._id,
          timestamp: new Date(doc.file_date).toISOString(),
          entity: doc.entity_name, sector: 'manufacturing',
          signalType: 'capex-disclosure', location: 'United States', value: 0,
          description: (doc.file_description || `${doc.form_type} filing by ${doc.entity_name}${highlights ? ' — ' + highlights.slice(0,300) : ''}`).slice(0, 2000),
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(doc.entity_name)}&type=${doc.form_type}`,
          otRelevanceScore: score, otKeywords: keywords,
          rawData: { form_type: doc.form_type, file_date: doc.file_date },
        });
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (e) { console.error('SEC error:', q, e.message); }
  }
  return signals;
}

function daysAgo(d) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().split('T')[0];
}

// Main
(async () => {
  console.log('Starting ingestion test...');
  console.log('Supabase URL:', SUPABASE_URL ? 'SET' : 'MISSING');
  
  console.log('\n--- Federal Register ---');
  const fr = await fetchFederalRegister();
  console.log('Fetched:', fr.length);
  
  console.log('\n--- USASpending ---');
  const usa = await fetchUSASpending();
  console.log('Fetched:', usa.length);
  
  console.log('\n--- SEC EDGAR ---');
  const sec = await fetchSecEdgar();
  console.log('Fetched:', sec.length);
  
  const all = [...fr, ...usa, ...sec];
  console.log('\n=== TOTAL SIGNALS:', all.length, '===');
  
  if (all.length > 0 && SUPABASE_URL && SUPABASE_KEY) {
    console.log('\nUpserting to Supabase...');
    await supabaseUpsert(all);
    console.log('Done!');
    
    // Verify
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/signals?select=id&limit=5`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const rows = await checkRes.json();
    console.log('Rows in DB after upsert:', rows.length, '(showing first 5)');
  }
  
  const top = all.sort((a,b) => b.otRelevanceScore - a.otRelevanceScore).slice(0,5);
  console.log('\nTop 5 by OT relevance:');
  for (const s of top) {
    console.log(`  [${s.otRelevanceScore}] ${s.source} | ${s.entity.slice(0,35)} | ${s.description.slice(0,60)}`);
  }
})();
