// ════════════════════════════════════════════════════════════════
//  CACI · LATAM INTELLIGENCE DASHBOARD — Code.gs
//  Reads: Meltwater (resumen + articulos) + Reddit + YouTube +
//         Google_News + Google_Trends + SEO_Rankings
//  AI: OpenAI Responses API grounded on spreadsheet data
// ════════════════════════════════════════════════════════════════

// ── OPENAI / SPREADSHEET CONFIG ──────────────────────────────────
// Default recommended general-purpose model.
// If you want the closest ChatGPT-style alias instead, use:
// const OPENAI_MODEL = 'gpt-5-chat-latest';
const OPENAI_MODEL    = 'gpt-5.4';
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1GqIjd56382iE5IpJ46i-oI0idXXaY8mvYxXvjwIRxRw/edit#gid=241357115';

const SHEET_RESUMEN   = 'resumen';
const SHEET_ARTICULOS = 'articulos';

// Keyword → Pillar mapping (used to classify Reddit / News / YouTube)
var KW_PILAR = {
  'trump':                   'Gov / Politics',
  'ice':                     'Gov / Politics',
  'iran':                    'Gov / Politics',
  'migración estados unidos':'Gov / Politics',
  'migracion estados unidos':'Gov / Politics',
  'estados unidos e iran':   'Gov / Politics',
  'visa estado unidense':    'USA General',
  'visa':                    'USA General',
  'estados unidos':          'USA General'
};

// ── WEB APP ENTRY POINT ─────────────────────────────────────────
function doGet() {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .setTitle('LATAM Intelligence · CACI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// ── CORE HELPERS ────────────────────────────────────────────────
function getSpreadsheet_() {
  if (SPREADSHEET_URL) return SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOpenAIKey_() {
  return PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY') || '';
}

function truncate_(value, maxLen) {
  var s = String(value || '');
  return s.length > maxLen ? s.substring(0, maxLen) : s;
}

function extractOpenAIText_(data) {
  if (!data) return '⚠️ Empty response from OpenAI.';
  if (data.error) return '⚠️ OpenAI error: ' + data.error.message;

  if (data.output && data.output.length) {
    var texts = [];
    data.output.forEach(function(item) {
      if (item.type === 'message' && item.content && item.content.length) {
        item.content.forEach(function(part) {
          if (part.type === 'output_text' && part.text) texts.push(part.text);
        });
      }
    });
    if (texts.length) return texts.join('\n').trim();
  }

  return '⚠️ No text returned by OpenAI.';
}

function callOpenAIResponses_(instructions, input, maxOutputTokens) {
  var apiKey = getOpenAIKey_();
  if (!apiKey) {
    return '⚠️ OpenAI key not configured. Save OPENAI_API_KEY in Script Properties.';
  }

  var url = 'https://api.openai.com/v1/responses';
  var payload = {
    model: OPENAI_MODEL,
    instructions: instructions,
    input: input,
    reasoning: { effort: 'none' },
    text: { verbosity: 'low' },
    max_output_tokens: maxOutputTokens || 500
  };

  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + apiKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var data = JSON.parse(resp.getContentText());
    return extractOpenAIText_(data);
  } catch (e) {
    return '⚠️ Error calling OpenAI: ' + e.message;
  }
}

// ── MAIN DATA ENTRY POINT ────────────────────────────────────────
function getDashboardData() {
  var ss = getSpreadsheet_();

  // ── Meltwater core (KPIs, pillars, sentiment distribution) ──
  var sheetR = ss.getSheetByName(SHEET_RESUMEN);
  var sheetA = ss.getSheetByName(SHEET_ARTICULOS);
  if (!sheetR) throw new Error('Sheet not found: ' + SHEET_RESUMEN);
  if (!sheetA) throw new Error('Sheet not found: ' + SHEET_ARTICULOS);

  var meltwaterSummary  = transformarResumen(filtrarResumen(parsearHoja(sheetR)));
  var meltwaterArticles = filtrarArticulos(parsearHoja(sheetA));

  // ── External sources (from Python scrapers via master_sync) ──
  var redditRows = readSheet(ss, 'Reddit_Monitor');
  var ytRows     = readSheet(ss, 'YouTube_Trends');
  var newsRows   = readSheet(ss, 'Google_News');
  var serpRows   = readSheet(ss, 'SEO_Rankings').slice(0, 100);
  var trendsRows = readSheet(ss, 'Google_Trends');
  var hnRows     = readSheet(ss, 'Hacker_News_Trends');

  // ── Normalize and merge all articles into one feed ──
  var redditNorm = normalizeReddit(redditRows);
  var ytNorm     = normalizeYoutube(ytRows);
  var newsNorm   = normalizeNews(newsRows);

  var allArticles = meltwaterArticles
    .concat(redditNorm)
    .concat(ytNorm)
    .concat(newsNorm);

  // ── Channel aggregate stats ──
  var channels = buildChannelStats(meltwaterSummary, redditNorm, ytNorm, newsNorm, trendsRows);

  // ── SERP snapshot for SEO intelligence card ──
  var serp = serpRows.map(function(r) {
    return {
      keyword:  r['keyword_busqueda'] || '',
      country:  r['pais_busqueda']    || '',
      position: r['position']         || '',
      title:    r['title']            || '',
      link:     r['link']             || '',
      snippet:  truncate_(r['snippet'] || '', 120)
    };
  });

  // ── Hacker News tech signals ──
  var hn = hnRows.slice(0, 20).map(function(r) {
    return {
      title:    r['titulo'] || r['title'] || '',
      points:   r['points'] || r['puntos'] || 0,
      comments: r['comments'] || r['comentarios'] || 0,
      url:      r['url'] || ''
    };
  });

  return {
    summary:  meltwaterSummary,
    articles: transformarArticulos(allArticles),
    channels: channels,
    serp:     serp,
    hn:       hn
  };
}

// ── READ SHEET SAFELY ─────────────────────────────────────────────
function readSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  return sheet ? parsearHoja(sheet) : [];
}

// ── NORMALIZE REDDIT → COMMON FORMAT ─────────────────────────────
function normalizeReddit(rows) {
  return rows.filter(function(r) {
    return r['titulo'] && r['sentimiento'];
  }).map(function(r) {
    var score = parseFloat(r['score']) || 0;
    return {
      widget_id:          'reddit',
      pilar:              kwToPilar(r['keyword_busqueda']),
      autor:              'r/' + (r['subreddit'] || 'latam'),
      handle:             'r/' + (r['subreddit'] || 'latam'),
      fuente:             'Reddit',
      pais:               r['pais_busqueda'] || 'LATAM',
      fecha_articulo:     r['fecha'] || '',
      contenido:          r['titulo'] || '',
      reach:              score * 80,
      sentiment_label:    normLabel(r['sentimiento']),
      sentimiento_filtro: normLabel(r['sentimiento']),
      similares:          parseInt(r['comentarios'], 10) || 0,
      keyword:            r['keyword_busqueda'] || '',
      url:                r['url'] || ''
    };
  });
}

// ── NORMALIZE YOUTUBE → COMMON FORMAT ────────────────────────────
function normalizeYoutube(rows) {
  return rows.filter(function(r) {
    return r['titulo'] && r['sentimiento_titulo'];
  }).map(function(r) {
    return {
      widget_id:          'youtube',
      pilar:              kwToPilar(r['keyword_busqueda']),
      autor:              r['canal'] || 'YouTube',
      handle:             r['canal'] || '',
      fuente:             'YouTube',
      pais:               r['pais_busqueda'] || 'LATAM',
      fecha_articulo:     (r['fecha'] || '').substring(0, 10),
      contenido:          r['titulo'] || '',
      reach:              15000,
      sentiment_label:    normLabel(r['sentimiento_titulo']),
      sentimiento_filtro: normLabel(r['sentimiento_titulo']),
      similares:          0,
      keyword:            r['keyword_busqueda'] || '',
      url:                r['url'] || ''
    };
  });
}

// ── NORMALIZE NEWS → COMMON FORMAT ───────────────────────────────
function normalizeNews(rows) {
  return rows.filter(function(r) {
    return r['titulo'] && r['sentimiento'];
  }).map(function(r) {
    var text = r['resumen'] ? r['titulo'] + ' — ' + r['resumen'] : r['titulo'];
    return {
      widget_id:          'news',
      pilar:              kwToPilar(r['keyword_busqueda']),
      autor:              r['fuente'] || 'News',
      handle:             '',
      fuente:             'News',
      pais:               r['pais_busqueda'] || 'LATAM',
      fecha_articulo:     (r['fecha'] || '').substring(0, 10),
      contenido:          truncate_(text, 400),
      reach:              50000,
      sentiment_label:    normLabel(r['sentimiento']),
      sentimiento_filtro: normLabel(r['sentimiento']),
      similares:          0,
      keyword:            r['keyword_busqueda'] || '',
      url:                r['url'] || ''
    };
  });
}

// ── KEYWORD → PILLAR HELPER ───────────────────────────────────────
function kwToPilar(kw) {
  var k = (kw || '').toLowerCase().trim();
  for (var key in KW_PILAR) {
    if (k.indexOf(key) !== -1) return KW_PILAR[key];
  }
  return 'USA General';
}

// ── NORMALIZE SENTIMENT LABEL ─────────────────────────────────────
function normLabel(s) {
  var v = (s || '').toLowerCase();
  if (v.indexOf('neg') !== -1 || v.indexOf('negat') !== -1) return 'Negative';
  if (v.indexOf('pos') !== -1 || v.indexOf('posit') !== -1) return 'Positive';
  return 'Neutral';
}

// ── BUILD CHANNEL STATS ──────────────────────────────────────────
function buildChannelStats(summary, reddit, youtube, news, trendsRows) {
  function countSent(rows) {
    var neg = 0, pos = 0, neu = 0;
    rows.forEach(function(r) {
      var s = (r['sentiment_label'] || '').toLowerCase();
      if (s.indexOf('neg') !== -1) neg++;
      else if (s.indexOf('pos') !== -1) pos++;
      else neu++;
    });
    return { total: rows.length, neg: neg, pos: pos, neu: neu };
  }

  var gs = summary.globalSentiment || {};
  var mwTotal = summary.kpis ? (summary.kpis.totalMentions.raw || 0) : 0;
  var result = {};

  if (mwTotal > 0) {
    result.meltwater = {
      total: mwTotal,
      neg:   gs.negative ? gs.negative.raw : 0,
      pos:   gs.positive ? gs.positive.raw : 0,
      neu:   gs.neutral  ? gs.neutral.raw  : 0
    };
  }

  if (reddit.length  > 0) result.reddit  = countSent(reddit);
  if (youtube.length > 0) result.youtube = countSent(youtube);
  if (news.length    > 0) result.news    = countSent(news);

  if (trendsRows.length > 0) {
    var kwMap = {};
    trendsRows.forEach(function(r) {
      var kw = r['keyword_busqueda'] || '';
      var val = parseFloat(r['interes_actual (0-100)'] || 0);
      var trend = r['tendencia_7d'] || '';
      if (!kw) return;

      if (!kwMap[kw]) kwMap[kw] = { vals: [], up: 0 };
      kwMap[kw].vals.push(val);
      if (trend && trend.toLowerCase() !== 'capturada') kwMap[kw].up++;
    });

    result.trends = Object.entries(kwMap).map(function(e) {
      var avg = e[1].vals.reduce(function(a, b) { return a + b; }, 0) / e[1].vals.length;
      return { keyword: e[0], avgInterest: Math.round(avg), trending: e[1].up > 0 };
    }).sort(function(a, b) { return b.avgInterest - a.avgInterest; });
  }

  return result;
}

// ── OPENAI-GROUNDED ANALYST ──────────────────────────────────────
function buildAIContextFromDashboard_(data) {
  if (!data) return 'No spreadsheet data available.';

  var summary = data.summary || {};
  var articles = (data.articles && data.articles.all) ? data.articles.all : [];
  var topKeywords = (data.articles && data.articles.topKeywords) ? data.articles.topKeywords.slice(0, 20) : [];
  var topActors = (data.articles && data.articles.topActors) ? data.articles.topActors.slice(0, 10) : [];
  var channels = data.channels || {};
  var serp = data.serp ? data.serp.slice(0, 8) : [];
  var hn = data.hn ? data.hn.slice(0, 6) : [];

  var pillarSummary = Object.keys(summary.pillars || {}).map(function(id) {
    var p = summary.pillars[id];
    return {
      name: p.name,
      status: p.status,
      negativePct: p.negativePct,
      neutralPct: p.neutralPct,
      positivePct: p.positivePct,
      engagement: p.engagement && p.engagement.formatted ? p.engagement.formatted : '—'
    };
  });

  var channelSummary = Object.keys(channels).map(function(key) {
    var c = channels[key];
    if (!c || typeof c !== 'object' || !c.total) return null;
    return {
      channel: key,
      total: c.total,
      negative: c.neg || 0,
      neutral: c.neu || 0,
      positive: c.pos || 0
    };
  }).filter(Boolean);

  var sampleSignals = articles.slice(0, 30).map(function(a) {
    return {
      source: a.fuente || '',
      pillar: a.pilar || '',
      sentiment: a.sentiment || '',
      country: a.pais || '',
      author: a.autor || '',
      reach: a.reachFmt || '',
      content: truncate_(a.contenido || '', 220),
      keywords: (a.keywords || []).slice(0, 6)
    };
  });

  var payload = {
    kpis: summary.kpis || {},
    globalSentiment: summary.globalSentiment || {},
    pillars: pillarSummary,
    channels: channelSummary,
    topKeywords: topKeywords,
    topActors: topActors,
    serp: serp,
    techSignals: hn,
    sampleSignals: sampleSignals
  };

  return JSON.stringify(payload);
}

function buildStrictAnalystInstructions_() {
  return [
    'You are a LATAM sentiment intelligence analyst.',
    'Answer ONLY using the spreadsheet-derived context provided to you.',
    'Do NOT invent facts, names, metrics, trends, causes, or conclusions not present in the context.',
    'If the answer is not supported by the context, say exactly: "I do not see enough evidence in the spreadsheet to answer that confidently."',
    'When possible, reference exact figures, percentages, channels, pillars, keywords, or examples from the context.',
    'Be concise, executive, and grounded.',
    'Never claim you checked other sources. Only use the provided spreadsheet context.'
  ].join(' ');
}

function askChatGPT(mensaje) {
  if (!mensaje) return '⚠️ Empty question.';
  var dashboardData = getDashboardData();
  var groundedContext = buildAIContextFromDashboard_(dashboardData);
  var instructions = buildStrictAnalystInstructions_();

  var userInput =
    'Spreadsheet context:\n' + groundedContext +
    '\n\nUser question:\n' + mensaje;

  return callOpenAIResponses_(instructions, userInput, 500);
}

// ── BACKWARD COMPATIBILITY ───────────────────────────────────────
// If your frontend still calls askGemini(q, ctx), this keeps it working.
function askGemini(mensaje, contexto) {
  return askChatGPT(mensaje);
}

// ── TRANSLATE PHRASES VIA OPENAI ─────────────────────────────────
function translatePhrases(phrases) {
  var apiKey = getOpenAIKey_();
  if (!apiKey) return phrases;

  var allPhrases = [];
  ['negative', 'positive', 'neutral'].forEach(function(key) {
    (phrases[key] || []).forEach(function(p) {
      allPhrases.push({ key: key, phrase: p.phrase, count: p.count });
    });
  });

  if (!allPhrases.length) return phrases;

  var prompt = [
    'Translate these Spanish social media phrases into clear natural English.',
    'Return ONLY a valid JSON array of strings.',
    'Do not add markdown, comments, or explanations.',
    JSON.stringify(allPhrases.map(function(p) { return p.phrase; }))
  ].join('\n');

  try {
    var raw = callOpenAIResponses_(
      'Return only valid JSON. No markdown. No extra text.',
      prompt,
      600
    ).trim();

    var translated = JSON.parse(raw);
    var result = { negative: [], positive: [], neutral: [] };

    allPhrases.forEach(function(p, i) {
      result[p.key].push({
        phrase: translated[i] || p.phrase,
        original: p.phrase,
        count: p.count
      });
    });

    return result;
  } catch (e) {
    return phrases;
  }
}

// ── PARSE SHEET → ARRAY OF OBJECTS ───────────────────────────────
function parsearHoja(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function(h) { return h.toString().trim(); });

  return values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = (row[i] || '').toString().trim();
    });
    return obj;
  });
}

// ── FILTER HELPERS ────────────────────────────────────────────────
function filtrarResumen(rows) {
  var VALIDAS = ['Mentions', 'Engagement', 'Reach', 'AI Summary'];
  return rows.filter(function(r) {
    if (VALIDAS.indexOf(r['tipo_metrica']) === -1) return false;
    if (r['tipo_metrica'] === 'AI Summary') return !!r['detalle_texto'];
    return parsearNum(r['valor']) !== null;
  });
}

function filtrarArticulos(rows) {
  return rows.filter(function(r) {
    return r['contenido'] && r['contenido'].length > 5 &&
           r['sentiment_label'] && r['widget_id'];
  });
}

// ── NUMBER HELPERS ────────────────────────────────────────────────
function parsearNum(raw) {
  if (!raw) return null;
  var s = raw.toString().trim();
  if (!s || s === '-') return null;
  if (/^[A-Za-z\s]+$/.test(s) || s === '+1') return null;

  var clean = s.replace(/[%,<]/g, '').trim();
  var match = clean.match(/^([\d.]+)([KMBT]?)$/i);
  if (!match) return null;

  var n = parseFloat(match[1]);
  var sfx = { K:1e3, M:1e6, B:1e9, T:1e12 };
  var s2 = (match[2] || '').toUpperCase();

  return s2 ? n * (sfx[s2] || 1) : n;
}

function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 1e12) return +(n / 1e12).toPrecision(3) + 'T';
  if (n >= 1e9)  return +(n / 1e9).toPrecision(3) + 'B';
  if (n >= 1e6)  return +(n / 1e6).toPrecision(3) + 'M';
  if (n >= 1e3)  return +(n / 1e3).toPrecision(3) + 'K';
  return String(Math.round(n));
}

function normSent(s) {
  var map = {
    'neutral': 'neutral',
    'negative': 'negative',
    'positive': 'positive',
    'not rated': 'not_rated',
    'total': 'total'
  };
  return map[(s || '').toLowerCase()] || (s || '').toLowerCase();
}

function pct(s) {
  return parseFloat((s || '0').replace(/[%<]/g, '')) || 0;
}

// ── TRANSFORM RESUMEN (Meltwater strategic view) ──────────────────
function transformarResumen(rows) {
  var gRows = rows.filter(function(r) {
    return r['widget_id'] === 'share-of-voice-main-pillars' && r['tipo_metrica'] === 'Mentions';
  });

  var globalSent = {};
  var totalMenciones = 0;

  gRows.forEach(function(r) {
    var key = normSent(r['sentimiento']);
    var val = parsearNum(r['valor']) || 0;
    globalSent[key] = { raw: val, pct: r['porcentaje'], formatted: fmt(val) };
    totalMenciones += val;
  });

  var engRows = rows.filter(function(r) {
    return r['tipo_metrica'] === 'Engagement' && r['sentimiento'] === 'Total';
  });

  var eng = {};
  engRows.forEach(function(r) {
    var val = parsearNum(r['valor']);
    var prev = parsearNum(r['periodo_anterior']);
    var vp = parseFloat(r['variacion_pct']) || null;
    eng[r['widget_id']] = {
      raw: val,
      formatted: fmt(val),
      previousFormatted: fmt(prev),
      variationPct: vp,
      variationFormatted: vp ? '+' + Math.round(vp) + '%' : null
    };
  });

  var reachRows = rows.filter(function(r) {
    return r['tipo_metrica'] === 'Reach';
  });

  var reach = reachRows.map(function(r) {
    var raw = parsearNum(r['valor']);
    return {
      label: r['sentimiento']
        .replace(' (ONGOING MONITORING)', '')
        .replace('USA/COL- ', '')
        .replace('USA/COL-', ''),
      raw: raw,
      formatted: fmt(raw),
      pct: r['porcentaje']
    };
  });

  var totalReach = reach.reduce(function(sum, item) {
    return sum + (item.raw || 0);
  }, 0);

  var PILLAR_IDS = [
    'usacol-entertainment',
    'usacol-economy',
    'usacol-health',
    'usacol-govpol',
    'usacol-culture',
    'usacol-general-usa-impact'
  ];

  var NOMBRES = {
    'usacol-entertainment': 'Entertainment',
    'usacol-economy': 'Economy',
    'usacol-health': 'Health',
    'usacol-govpol': 'Gov / Politics',
    'usacol-culture': 'Culture',
    'usacol-general-usa-impact': 'USA General'
  };

  var ICONS = {
    'usacol-entertainment': 'movie',
    'usacol-economy': 'payments',
    'usacol-health': 'medical_services',
    'usacol-govpol': 'account_balance',
    'usacol-culture': 'theater_comedy',
    'usacol-general-usa-impact': 'public'
  };

  var pillars = {};
  PILLAR_IDS.forEach(function(id) {
    var pRows = rows.filter(function(r) {
      return r['widget_id'] === id &&
             r['tipo_metrica'] === 'Mentions' &&
             parsearNum(r['valor']) !== null;
    });

    if (!pRows.length) return;

    var sentiment = {};
    pRows.forEach(function(r) {
      var key = normSent(r['sentimiento']);
      var val = parsearNum(r['valor']) || 0;
      sentiment[key] = { raw: val, pct: r['porcentaje'], formatted: fmt(val) };
    });

    var negPct = pct(sentiment.negative ? sentiment.negative.pct : '0');
    var posPct = pct(sentiment.positive ? sentiment.positive.pct : '0');
    var neuPct = pct(sentiment.neutral  ? sentiment.neutral.pct  : '0');

    var status, statusColor;
    if (negPct >= 40) {
      status = 'HIGH RISK';
      statusColor = '#BA1A1A';
    } else if (negPct >= 25) {
      status = 'WATCH';
      statusColor = '#d97706';
    } else if (negPct >= 15) {
      status = 'MONITOR';
      statusColor = '#64748b';
    } else {
      status = 'OPPORTUNITY';
      statusColor = '#16a34a';
    }

    pillars[id] = {
      id: id,
      name: NOMBRES[id],
      icon: ICONS[id],
      sentiment: sentiment,
      negativePct: negPct,
      positivePct: posPct,
      neutralPct: neuPct,
      status: status,
      statusColor: statusColor,
      engagement: eng[id] || {}
    };
  });

  var aiRows = rows.filter(function(r) {
    return r['tipo_metrica'] === 'AI Summary';
  });

  var aiSummaries = {};
  aiRows.forEach(function(r) {
    var id = r['widget_id'];
    if (!aiSummaries[id]) aiSummaries[id] = { positive: [], negative: [] };
    var key = r['sentimiento'].toLowerCase().indexOf('positive') !== -1 ? 'positive' : 'negative';
    aiSummaries[id][key].push(r['detalle_texto']);
  });

  var pillarList = Object.values(pillars);
  var highestRisk = pillarList.slice().sort(function(a, b) { return b.negativePct - a.negativePct; })[0];
  var topOpp = pillarList.slice().sort(function(a, b) { return b.positivePct - a.positivePct; })[0];

  return {
    meta: {
      reportDate: rows[0] ? rows[0]['fecha_reporte'] : '',
      dateRange: 'Apr 9, 2025 – Apr 8, 2026'
    },
    kpis: {
      totalEngagement: eng['usacol-overall-pillars'] || {},
      totalMentions:   { raw: totalMenciones, formatted: fmt(totalMenciones) },
      totalReach:      { raw: totalReach, formatted: fmt(totalReach) },
      highestRisk:     highestRisk ? { name: highestRisk.name, pct: highestRisk.negativePct, status: highestRisk.status } : null,
      topOpportunity:  topOpp ? { name: topOpp.name, pct: topOpp.positivePct } : null
    },
    globalSentiment: globalSent,
    pillars: pillars,
    reach: reach,
    aiSummaries: aiSummaries
  };
}

// ── TRANSFORM ARTICLES (all sources merged) ───────────────────────
function transformarArticulos(rows) {
  function extractKeywords(content) {
    var sw = [
      'the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','get','has','him','his',
      'how','new','now','see','two','way','who','did','its','say','she','too','use','que','los','las','con','una','del',
      'por','para','como','https','t.co','www','com','co','más','sus','son','han','este','hay','esto','está','también'
    ];

    var text = (content || '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^a-záéíóúñüa-z0-9\s]/gi, ' ');

    var compounds = [
      'estados unidos iran',
      'estados unidos e iran',
      'estados unidos',
      'migración estados unidos',
      'migracion estados unidos',
      'visa estado unidense',
      'united states'
    ];

    var found = [];
    compounds.forEach(function(c) {
      if (text.indexOf(c) !== -1) {
        found.push(c);
        text = text.split(c).join('   ');
      }
    });

    var words = text.split(/\s+/).filter(function(w) {
      return w.length > 3 && sw.indexOf(w) === -1;
    });

    return found.concat(words).slice(0, 8);
  }

  var mapped = rows.map(function(r) {
    var rawReach = parsearNum(r['reach']) || parseFloat(r['reach']) || 0;
    return {
      id:        r['widget_id'] || '',
      pilar:     r['pilar'] || kwToPilar(r['keyword'] || ''),
      autor:     r['autor'] || 'Unknown',
      handle:    r['handle'] || '',
      fuente:    r['fuente'] || 'Meltwater',
      pais:      r['pais'] || r['pais_busqueda'] || '',
      fecha:     r['fecha_articulo'] || r['fecha'] || '',
      contenido: r['contenido'] || '',
      keywords:  extractKeywords(r['contenido']),
      reach:     rawReach,
      reachFmt:  fmt(rawReach),
      sentiment: r['sentiment_label'] || r['sentimiento_filtro'] || 'Neutral',
      similares: parseInt(r['similares'], 10) || 0,
      url:       r['url'] || ''
    };
  });

  mapped.sort(function(a, b) { return b.reach - a.reach; });

  var kwFreq = {};
  mapped.forEach(function(a) {
    a.keywords.forEach(function(w) {
      kwFreq[w] = (kwFreq[w] || 0) + 1;
    });
  });

  var topKeywords = Object.entries(kwFreq)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 40)
    .map(function(e) { return { word: e[0], count: e[1] }; });

  var srcCount = {};
  mapped.forEach(function(a) {
    srcCount[a.fuente] = (srcCount[a.fuente] || 0) + 1;
  });

  var TL_MONTHS = {
    jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
    jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12'
  };

  var timelineMap = {};
  mapped.forEach(function(a) {
    var fecha = (a.fecha || '').trim();
    var key = 'Unknown';

    if (fecha.match(/^\d{4}-\d{2}/)) {
      key = fecha.substring(0, 7);
    } else {
      var m1 = fecha.match(/^([A-Za-z]+)\s+\d+,\s*(\d{4})/);
      if (m1) {
        var mo1 = TL_MONTHS[m1[1].toLowerCase().substring(0, 3)];
        if (mo1) key = m1[2] + '-' + mo1;
      } else {
        var m2 = fecha.match(/^([A-Za-z]+)\s+\d+/);
        if (m2) {
          var mo2 = TL_MONTHS[m2[1].toLowerCase().substring(0, 3)];
          if (mo2) key = (parseInt(mo2, 10) >= 5 ? '2025' : '2026') + '-' + mo2;
        }
      }
    }

    if (!timelineMap[key]) timelineMap[key] = { neg: 0, pos: 0, neu: 0, total: 0 };

    var s = (a.sentiment || '').toLowerCase();
    if (s.indexOf('neg') !== -1) timelineMap[key].neg++;
    else if (s.indexOf('pos') !== -1) timelineMap[key].pos++;
    else timelineMap[key].neu++;

    timelineMap[key].total++;
  });

  var actorMap = {};
  mapped.forEach(function(a) {
    var key = a.handle || a.autor;
    if (!actorMap[key]) {
      actorMap[key] = {
        name: a.autor,
        handle: a.handle,
        fuente: a.fuente,
        reach: 0,
        count: 0,
        sentiments: {}
      };
    }

    actorMap[key].reach += a.reach;
    actorMap[key].count++;

    var s = (a.sentiment || '').toLowerCase().indexOf('neg') !== -1 ? 'neg'
          : (a.sentiment || '').toLowerCase().indexOf('pos') !== -1 ? 'pos'
          : 'neu';

    actorMap[key].sentiments[s] = (actorMap[key].sentiments[s] || 0) + 1;
  });

  var topActors = Object.values(actorMap)
    .sort(function(a, b) { return b.reach - a.reach; })
    .slice(0, 20)
    .map(function(a) {
      a.reachFmt = fmt(a.reach);
      var dom = Object.entries(a.sentiments).sort(function(x, y) { return y[1] - x[1]; });
      a.dominantSent = dom.length ? dom[0][0] : 'neu';
      return a;
    });

  return {
    all:             mapped.slice(0, 300),
    topKeywords:     topKeywords,
    sourceBreakdown: srcCount,
    timeline:        timelineMap,
    topActors:       topActors,
    total:           mapped.length
  };
}

// ── SEND REPORT EMAIL ─────────────────────────────────────────────
function sendReportRequest(data) {
  var NOTIFY_EMAIL = 'tu@email.com';
  var subject = '[LATAM Intelligence · CACI] ' + data.topic + ' (' + data.priority + ')';
  var body =
    'Topic: ' + data.topic + '\n' +
    'Priority: ' + data.priority + '\n' +
    'From: ' + data.name + ' <' + data.email + '>\n' +
    'Notes: ' + (data.notes || '—') + '\n' +
    'Date: ' + new Date().toLocaleString();

  MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  MailApp.sendEmail(
    data.email,
    'Report request received — LATAM Intelligence',
    'Hello ' + data.name + ',\n\nWe received your request: ' + data.topic +
    '\nPriority: ' + data.priority +
    '\n\nOur analysts will contact you shortly.\n\n— LATAM Intelligence · CACI'
  );

  return { success: true };
}

// ── SHEETS MENU ───────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🟠 LATAM Intelligence')
    .addItem('Open Dashboard', 'abrirDashboard')
    .addToUi();
}

function abrirDashboard() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput('<script>window.open("' + url + '","_blank");google.script.host.close();</script>'),
    'Opening...'
  );
}