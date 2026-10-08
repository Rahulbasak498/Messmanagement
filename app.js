(function () {
  var MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  var DAYS = ['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি'];
  var $ = function (id) { return document.getElementById(id); };
  var now = new Date();
  var startYm = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var ym = startYm, S = null, tab = 'hishab', dashboardDay = null, dbNS = null, dlNS = null, saveTimer = null, toastTimer = null;
  var MARKET_ORDER_KEY = 'mess-market-order-v2';
  var PREFERRED_MARKET_ORDER = ['Tasik Adnan', 'Shoumik Saha', 'Gopal Roy', 'Ashim Bhoumik', 'Rahul Basak Santo'];
  var SUMMARY_MEMBER_ORDER = ['rahul basak santo', 'tasik adnan', 'gopal roy', 'shoumik saha', 'ashim bhoumik'];

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function num(v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; }
  function f2(n) { return n.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fm(n) { return (+n.toFixed(2)).toLocaleString('bn-BD', { maximumFractionDigits: 2 }); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function parts(k) { var p = k.split('-'); return [Number(p[0]), Number(p[1])]; }
  function dim(k) { var p = parts(k); return new Date(p[0], p[1], 0).getDate(); }
  function shift(k, d) { var p = parts(k); var dt = new Date(p[0], p[1] - 1 + d, 1); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'); }
  function label(k) { var p = parts(k); return MONTHS[p[1] - 1] + ' ' + p[0].toLocaleString('bn-BD'); }
  function dayLabel(d) { var p = parts(ym); return d.toLocaleString('bn-BD') + ' ' + MONTHS[p[1] - 1] + ', ' + DAYS[new Date(p[0], p[1] - 1, d).getDay()]; }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function setStatus(s) { $('status').textContent = s; }
  function memberName(id) { var m = S.members.filter(function (x) { return x.id === id; })[0]; return m ? m.name : '?'; }
  function summaryMemberRank(name) {
    var rank = SUMMARY_MEMBER_ORDER.indexOf(String(name).toLowerCase());
    return rank < 0 ? SUMMARY_MEMBER_ORDER.length : rank;
  }
  function mealCount(value) {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'object') return 0;
    return num(value.breakfast) + num(value.lunch) + num(value.dinner);
  }
  function mealSlot(day, memberId, slot) {
    var value = S.meals[day] && S.meals[day][memberId];
    return typeof value === 'object' && value ? (value[slot] || '') : (slot === 'lunch' && value ? value : '');
  }
  function bazarAssignee(day) {
    if (!S.members.length) return null;
    return S.members[Math.min(Math.floor((day - 1) / 6), S.members.length - 1)];
  }
  function applyMarketOrder(st) {
    var order = null;
    try { order = JSON.parse(localStorage.getItem(MARKET_ORDER_KEY) || 'null'); } catch (e) {}
    if (!Array.isArray(order) || !order.length) {
      if (st.members.length !== PREFERRED_MARKET_ORDER.length) return false;
      var byName = {};
      st.members.forEach(function (m) { byName[m.name.toLowerCase()] = m; });
      var preferred = PREFERRED_MARKET_ORDER.map(function (name) { return byName[name.toLowerCase()]; });
      if (preferred.some(function (m) { return !m; })) return false;
      order = preferred.map(function (m) { return m.id; });
      try { localStorage.setItem(MARKET_ORDER_KEY, JSON.stringify(order)); } catch (e) {}
    }
    var byId = {};
    st.members.forEach(function (m) { byId[m.id] = m; });
    var reordered = order.map(function (id) { return byId[id]; }).filter(Boolean);
    st.members.forEach(function (m) { if (reordered.indexOf(m) < 0) reordered.push(m); });
    var changed = reordered.some(function (m, index) { return st.members[index] !== m; });
    if (changed) st.members = reordered;
    return changed;
  }
  function saveMarketOrder() {
    try { localStorage.setItem(MARKET_ORDER_KEY, JSON.stringify(S.members.map(function (m) { return m.id; }))); } catch (e) {}
  }
  /* ---------- data ---------- */
  function defaultFixed() {
    return ['সার্ভিস চার্জ', 'গৃহকর্মীর বেতন', 'ইন্টারনেট বিল', 'ময়লার বিল', 'গ্যাস বিল'].map(function (n) {
      return { id: uid(), name: n, amount: 0, split: 'equal', custom: {}, locked: true };
    });
  }
  /* equal: one amount shared by everyone. custom: each member has his own amount. */
  function fixedAmount(x) {
    if (x.split !== 'custom') return x.amount || 0;
    var t = 0; S.members.forEach(function (m) { t += (x.custom && x.custom[m.id]) || 0; }); return t;
  }
  function fixedFor(x, m) {
    if (x.split === 'custom') return (x.custom && x.custom[m.id]) || 0;
    return S.members.length ? (x.amount || 0) / S.members.length : 0;
  }
  function fixedLabel(name) {
    if (name === 'গৃহকর্মীর বেতন') return 'বুয়ার বেতন';
    if (name === 'ইন্টারনেট বিল') return 'Wi-Fi বিল';
    return name;
  }
  function blankState() { return { name: 'আমাদের মেস', members: [], meals: {}, bazar: [], fixed: defaultFixed(), sample: false }; }
  async function readMonth(k) {
    if (dbNS) {
      try { var sn = await dbNS.doc('months/' + k).get(); if (sn.exists) { return JSON.parse(sn.data().json); } } catch (e) {}
    }
    try { var raw = localStorage.getItem('mess:' + k); if (raw) { return JSON.parse(raw); } } catch (e) {}
    return null;
  }
  async function loadMonth(k) {
    var st = await readMonth(k);
    var discardSample = !!(st && st.sample);
    if (discardSample) st = blankState();
    if (!st) {
      var prev = await readMonth(shift(k, -1));
      if (prev && !prev.sample) {
        st = { name: prev.name, members: prev.members.map(function (m) { return { id: m.id, name: m.name, joma: 0, rent: m.rent || 0 }; }), meals: {}, bazar: [], fixed: prev.fixed.map(function (x) { return { id: x.id, name: x.name, amount: x.amount, split: x.split || 'equal', custom: Object.assign({}, x.custom || {}), locked: !!x.locked }; }), sample: false };
      } else if (k === startYm && !prev) {
        st = blankState();
      } else {
        st = blankState();
      }
    }
    var migrated = migrate(st), reordered = applyMarketOrder(st);
    S = st; ym = k;
    if (discardSample || migrated || reordered) await doSave();
  }
  function migrate(st) {
    var isRent = function (x) { return /basa|bhara|vara/i.test(x.name); };
    var lockedNames = ['সার্ভিস চার্জ', 'গৃহকর্মীর বেতন', 'ইন্টারনেট বিল', 'ময়লার বিল', 'গ্যাস বিল'];
    var changed = false;
    var hasRent = st.members.some(function (m) { return m.rent > 0; });
    var keep = [];
    st.fixed.forEach(function (x) {
      if (x.name === 'পানির বিল') { x.name = 'ময়লার বিল'; changed = true; }
      if (!x.locked && lockedNames.indexOf(x.name) >= 0) { x.locked = true; changed = true; }
      if (!isRent(x)) { keep.push(x); return; }
      if (!hasRent) {
        S = st; /* fixedFor reads S.members */
        st.members.forEach(function (m) { m.rent = r2(fixedFor(x, m)); });
        hasRent = st.members.some(function (m) { return m.rent > 0; });
      }
    });
    st.fixed = keep;
    if (!st.fixed.some(function (x) { return x.name === 'গ্যাস বিল'; })) {
      st.fixed.push({ id: uid(), name: 'গ্যাস বিল', amount: 0, split: 'equal', custom: {}, locked: true });
      changed = true;
    }
    st.members.forEach(function (m) { if (typeof m.rent !== 'number') m.rent = 0; });
    Object.keys(st.meals).forEach(function (d) {
      Object.keys(st.meals[d]).forEach(function (id) {
        if (typeof st.meals[d][id] === 'number') st.meals[d][id] = { breakfast: 0, lunch: st.meals[d][id], dinner: 0 };
      });
    });
    return changed;
  }
  function queueSave() { setStatus('সেভ হচ্ছে...'); clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 500); }
  async function doSave() {
    clearTimeout(saveTimer);
    if (!S) return;
    var k = ym, json = JSON.stringify(S);
    var localSaved = false;
    try { localStorage.setItem('mess:' + k, json); localSaved = true; } catch (e) {}
    if (dbNS) {
      try { await dbNS.doc('months/' + k).set({ json: json, updated: Date.now() }); setStatus('তথ্য সেভ হয়েছে'); }
      catch (e) { setStatus(localSaved ? 'এই ব্রাউজারে সেভ হয়েছে' : 'সেভ হয়নি — স্টোরেজ খালি করুন'); }
    } else { setStatus(localSaved ? 'এই ব্রাউজারে সেভ হয়েছে' : 'সেভ হয়নি — স্টোরেজ খালি করুন'); }
  }

  /* ---------- calculation ---------- */
  function calc() {
    var n = S.members.length, totalMeal = 0, totalBazar = 0, mealBy = {}, spentBy = {};
    S.members.forEach(function (m) { mealBy[m.id] = 0; spentBy[m.id] = 0; });
    Object.keys(S.meals).forEach(function (d) {
      var day = S.meals[d];
      Object.keys(day).forEach(function (mid) { var count = mealCount(day[mid]); if (mid in mealBy) { mealBy[mid] += count; totalMeal += count; } });
    });
    S.bazar.forEach(function (b) { totalBazar += b.amount; if (b.mid in spentBy) spentBy[b.mid] += b.amount; });
    var fixedTotal = S.fixed.reduce(function (a, x) { return a + fixedAmount(x); }, 0);
    var rentTotal = S.members.reduce(function (a, m) { return a + (m.rent || 0); }, 0);
    var rate = totalMeal > 0 ? totalBazar / totalMeal : 0;
    var share = n ? fixedTotal / n : 0;
    var rows = S.members.map(function (m) {
      var share = S.fixed.reduce(function (a, x) { return a + fixedFor(x, m); }, 0);
      var meals = mealBy[m.id], mealCost = meals * rate, rent = m.rent || 0, bill = rent + mealCost + share, spent = spentBy[m.id], paid = spent + m.joma;
      return { id: m.id, name: m.name, rent: rent, meals: meals, mealCost: mealCost, share: share, bill: bill, spent: spent, joma: m.joma, balance: paid - bill };
    });
    var pabe = 0, dibe = 0;
    rows.forEach(function (r) { if (r.balance > 0.005) pabe += r.balance; else if (r.balance < -0.005) dibe += -r.balance; });
    return { n: n, rentTotal: rentTotal, totalMeal: totalMeal, totalBazar: totalBazar, fixedTotal: fixedTotal, rate: rate, share: share, rows: rows, pabe: pabe, dibe: dibe };
  }
  function pill(b) {
    if (b > 0.005) return '<span class="pill good">পাবেন ' + f2(b) + '</span>';
    if (b < -0.005) return '<span class="pill bad">দেবেন ' + f2(-b) + '</span>';
    return '<span class="pill zero">সমান</span>';
  }

  /* ---------- views ---------- */
  function tile(k, v, s, hot) { return '<div class="tile' + (hot ? ' hot' : '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }

  function viewHishab() {
    var c = calc();
    var summaryRows = c.rows.slice().sort(function (a, b) {
      return summaryMemberRank(a.name) - summaryMemberRank(b.name);
    });
    var daysInMonth = dim(ym), selectedDay = dashboardDay && dashboardDay <= daysInMonth ? dashboardDay : (ym === startYm ? Math.min(now.getDate(), daysInMonth) : 1);
    var dayOptions = '', lunchTotal = 0, dinnerTotal = 0, dailyMarketTotal = 0, dailyMeals = {}, dailyMarket = {};
    for (var date = 1; date <= daysInMonth; date++) dayOptions += '<option value="' + date + '"' + (date === selectedDay ? ' selected' : '') + '>' + dayLabel(date) + '</option>';
    S.members.forEach(function (m) {
      var lunch = num(mealSlot(selectedDay, m.id, 'lunch')), dinner = num(mealSlot(selectedDay, m.id, 'dinner'));
      dailyMeals[m.id] = { lunch: lunch, dinner: dinner };
      lunchTotal += lunch; dinnerTotal += dinner; dailyMarket[m.id] = 0;
    });
    S.bazar.forEach(function (b) {
      if (b.day === selectedDay) { dailyMarketTotal += b.amount; if (b.mid in dailyMarket) dailyMarket[b.mid] += b.amount; }
    });
    var h = '<section class="tiles">' +
      tile('মোট বাজার', f2(c.totalBazar), '৳, ' + S.bazar.length.toLocaleString('bn-BD') + 'টি কেনাকাটা') +
      tile('মোট মিল', fm(c.totalMeal), c.n.toLocaleString('bn-BD') + ' জন সদস্য') +
      tile('মিলের দর', f2(c.rate), 'প্রতি মিল, ৳', true) +
      tile('বাসা ভাড়া', f2(c.rentTotal), '৳, প্রত্যেকের আলাদা') +
      tile('অন্যান্য নির্ধারিত খরচ', f2(c.fixedTotal), '৳, গড়ে জনপ্রতি ' + f2(c.share)) +
      '</section>';
    h += '<section class="panel daily-summary"><div class="daily-summary-head"><h2>দৈনিক সারাংশ</h2><div class="field"><label for="summaryDay">তারিখ</label><select id="summaryDay" class="inp">' + dayOptions + '</select></div></div>' +
      '<div class="chips"><span class="chip">দুপুরের মিল <b>' + fm(lunchTotal) + '</b></span><span class="chip">রাতের মিল <b>' + fm(dinnerTotal) + '</b></span><span class="chip">মোট মিল <b>' + fm(lunchTotal + dinnerTotal) + '</b></span><span class="chip">বাজার <b>' + f2(dailyMarketTotal) + ' ৳</b></span></div>';
    if (S.members.length) {
      h += '<div class="tablewrap"><table><thead><tr><th>সদস্য</th><th class="n">দুপুর</th><th class="n">রাত</th><th class="n">মোট মিল</th><th class="n">বাজার (৳)</th></tr></thead><tbody>';
      summaryRows.forEach(function (r) {
        var meals = dailyMeals[r.id] || { lunch: 0, dinner: 0 };
        h += '<tr><td class="name">' + esc(r.name) + '</td><td class="n">' + fm(meals.lunch) + '</td><td class="n">' + fm(meals.dinner) + '</td><td class="n">' + fm(meals.lunch + meals.dinner) + '</td><td class="n">' + f2(dailyMarket[r.id] || 0) + '</td></tr>';
      });
      h += '</tbody><tfoot><tr><td>মোট</td><td class="n">' + fm(lunchTotal) + '</td><td class="n">' + fm(dinnerTotal) + '</td><td class="n">' + fm(lunchTotal + dinnerTotal) + '</td><td class="n">' + f2(dailyMarketTotal) + '</td></tr></tfoot></table></div>';
    }
    h += '</section>';
    var summaryVisible = S.showMemberSummary === true;
    h += '<section class="panel"><div class="summary-panel-head"><h2>সদস্যভিত্তিক হিসাব</h2><button class="btn small" data-act="toggleMemberSummary">' + (summaryVisible ? 'হিসাব লুকান' : 'হিসাব দেখুন') + '</button></div>';
    if (!summaryVisible) {
      h += '<p class="hint">মাসের বাকি তথ্য যোগ করা হলে এখানে সদস্যভিত্তিক হিসাব দেখুন।</p>';
    } else {
      if (c.totalMeal === 0 && c.totalBazar > 0) h += '<p class="warn">মিলের তথ্য নেই, তাই মিলের দর ০ দেখাচ্ছে। মিল বিভাগে মিলের সংখ্যা লিখুন।</p>';
      if (!c.n) {
        h += '<p class="hint">এখনো কোনো সদস্য নেই। সদস্য বিভাগে গিয়ে নাম যোগ করুন।</p>';
      } else {
        h += '<div class="tablewrap"><table><thead><tr><th>সদস্য</th><th class="n">বাসা ভাড়া</th><th class="n">মিল</th><th class="n">মিলের খরচ</th>' +
          S.fixed.map(function (x) { return '<th class="n">' + esc(fixedLabel(x.name)) + '</th>'; }).join('') +
          '<th class="n">মোট বিল</th><th class="n">বাজার করেছেন</th><th>অবস্থা</th></tr></thead><tbody>';
        summaryRows.forEach(function (r) {
          var member = S.members.filter(function (m) { return m.id === r.id; })[0];
          h += '<tr><td class="name">' + esc(r.name) + '</td><td class="n">' + f2(r.rent) + '</td><td class="n">' + fm(r.meals) + '</td><td class="n">' + f2(r.mealCost) + '</td>' +
            S.fixed.map(function (x) { return '<td class="n">' + f2(fixedFor(x, member)) + '</td>'; }).join('') +
            '<td class="n">' + f2(r.bill) + '</td><td class="n">' + f2(r.spent) + '</td><td>' + pill(r.balance) + '</td></tr>';
        });
        h += '</tbody><tfoot><tr><td>মোট</td><td class="n">' + f2(c.rentTotal) + '</td><td class="n">' + fm(c.totalMeal) + '</td><td class="n">' + f2(c.totalBazar) + '</td>' +
          S.fixed.map(function (x) { return '<td class="n">' + f2(fixedAmount(x)) + '</td>'; }).join('') +
          '<td class="n">' + f2(c.rentTotal + c.totalBazar + c.fixedTotal) + '</td><td class="n">' + f2(c.totalBazar) + '</td><td></td></tr></tfoot></table></div>';
        h += '<div class="chips"><span class="chip">মোট পাবেন <b>' + f2(c.pabe) + '</b></span><span class="chip">মোট দেবেন <b>' + f2(c.dibe) + '</b></span></div>';
      }
      h += '<p class="hint">হিসাবের নিয়ম: বাসা ভাড়া + মিলের খরচ + অন্যান্য নির্ধারিত খরচ = মোট বিল। বাজারের খরচ ও জমা টাকা বিল থেকে বাদ যায়। বাকি থাকলে দেবেন, বেশি জমা থাকলে পাবেন। মিলের দর = মোট বাজার ÷ মোট মিল।</p>';
    }
    h += '</section>';
    h += '<section class="panel"><h2>রিপোর্ট</h2><div class="row"><button class="btn primary" data-act="xlsx">এক্সেল ডাউনলোড</button><button class="btn" data-act="pdf">পিডিএফ ডাউনলোড</button></div></section>';
    return h;
  }

  function viewMeal() {
    var days = dim(ym), h = '<section class="panel"><h2>প্রতিদিনের মিল</h2><p class="hint">প্রতিদিন প্রত্যেকের দুপুর ও রাতের মিলের সংখ্যা লিখুন। পূর্ণ সংখ্যা দিন; ঘর খালি রাখলে ০ ধরা হবে।</p>';
    if (!S.members.length) return h + '<p class="hint">আগে সদস্য বিভাগে সদস্য যোগ করুন।</p></section>';
    var mealMembers = S.members.slice().sort(function (a, b) { return summaryMemberRank(a.name) - summaryMemberRank(b.name); });
    h += '<div class="tablewrap"><table class="grid" id="mealGrid"><thead><tr><th rowspan="2">দিন</th>';
    mealMembers.forEach(function (m) { h += '<th class="n" colspan="2">' + esc(m.name) + '</th>'; });
    h += '<th class="n" rowspan="2">মিল</th></tr><tr>';
    mealMembers.forEach(function () { h += '<th><span class="meal-slot">দুপুর</span></th><th><span class="meal-slot">রাত</span></th>'; });
    h += '</tr></thead><tbody>';
    for (var d = 1; d <= days; d++) {
      h += '<tr><td class="day">' + dayLabel(d) + '</td>';
      mealMembers.forEach(function (m) {
        ['lunch', 'dinner'].forEach(function (slot, index) {
          var v = mealSlot(d, m.id, slot), labels = ['দুপুর', 'রাত'];
          h += '<td class="n"><input class="inp num meal-input" type="number" inputmode="numeric" min="1" step="1" placeholder="–" data-f="meal" data-slot="' + slot + '" data-d="' + d + '" data-m="' + m.id + '" value="' + v + '" aria-label="' + esc(m.name) + ', ' + d.toLocaleString('bn-BD') + ' তারিখ, ' + labels[index] + '"></td>';
        });
      });
      h += '<td class="n" data-live="dmeal" data-d="' + d + '"></td></tr>';
    }
    h += '</tbody><tfoot><tr><td>মোট</td>';
    mealMembers.forEach(function (m) { h += '<td class="n" data-live="mmeal" data-m="' + m.id + '"></td>'; });
    h += '<td class="n" data-live="tmeal"></td></tr></tfoot></table></div></section>';
    return h;
  }

  function viewBazar() {
    var h = '<section class="panel"><h2>বাজারের তথ্য যোগ করুন</h2>';
    if (!S.members.length) return h + '<p class="hint">আগে সদস্য বিভাগে সদস্য যোগ করুন।</p></section>';
    var days = dim(ym), dayOpts = '';
    var setupComplete = S.members.length === 5;
    var today = (ym === startYm) ? now.getDate() : 1;
    var selectedDay = today <= days ? today : 1;
    if (setupComplete) for (var d = 1; d <= days; d++) {
      var assigned = bazarAssignee(d);
      dayOpts += '<option value="' + d + '"' + (d === selectedDay ? ' selected' : '') + '>' + dayLabel(d) + ' — ' + esc(assigned.name) + '</option>';
    }
    var turnText = setupComplete ? S.members.map(function (m) {
      var range = []; for (var d = 1; d <= days; d++) if (bazarAssignee(d).id === m.id) range.push(d);
      return '<span class="chip">' + esc(m.name) + ': <b>' + (range.length ? range[0].toLocaleString('bn-BD') + '–' + range[range.length - 1].toLocaleString('bn-BD') : '—') + '</b></span>';
    }).join('') : '';
    h += '<p class="hint">প্রতি ৬ দিন পর বাজারের পালা পরের সদস্যের। সদস্য তালিকার ক্রম অনুযায়ী দায়িত্ব নির্ধারিত হয়.</p>' + (setupComplete ? '<h3 style="font-size:15px">বাজারের পালার তালিকা</h3><div class="chips">' + turnText + '</div>' : '');
    if (!setupComplete) h += '<div class="turn">বাজারের পালা চালু করতে সদস্য বিভাগে ৫ জন যোগ করুন। এখন সদস্য: ' + S.members.length.toLocaleString('bn-BD') + '/৫ জন।</div>';
    else h += '<div class="turn" id="bzAssignee">এই তারিখে বাজারের দায়িত্ব: <b>' + esc(bazarAssignee(selectedDay).name) + '</b></div>' +
      '<div class="row"><div class="field"><label for="bzDay">তারিখ ও দায়িত্বপ্রাপ্ত সদস্য</label><select id="bzDay" class="inp">' + dayOpts + '</select></div>' +
      '<div class="field"><label for="bzAmt">টাকার পরিমাণ *</label><input id="bzAmt" class="inp num" type="number" inputmode="decimal" min="0.01" step="any" placeholder="০" style="width:130px" required></div>' +
      '<div class="field" style="flex:1 1 180px"><label for="bzNote">কী কিনেছেন</label><input id="bzNote" class="inp" type="text" maxlength="60" placeholder="চাল, সবজি, তেল..."></div>' +
      '<button class="btn primary" data-act="addBazar">যোগ করুন</button></div></section>';
    var c = calc();
    h += '<section class="panel"><h2>বাজারের তালিকা</h2>';
    h += '<div class="chips">' + c.rows.map(function (r) { return '<span class="chip">' + esc(r.name) + ' <b>' + f2(r.spent) + '</b></span>'; }).join('') + '</div>';
    if (!S.bazar.length) { h += '<p class="hint">এখনো কোনো বাজারের তথ্য যোগ করা হয়নি।</p>'; }
    else {
      var list = S.bazar.slice().sort(function (a, b) { return a.day - b.day; });
      h += '<div class="tablewrap"><table><thead><tr><th>তারিখ</th><th>সদস্য</th><th>কেনাকাটা</th><th class="n">টাকা</th><th></th></tr></thead><tbody>';
      list.forEach(function (b) {
        h += '<tr><td>' + dayLabel(b.day) + '</td><td class="name">' + esc(memberName(b.mid)) + '</td><td>' + esc(b.note || '') + '</td><td class="n">' + f2(b.amount) + '</td><td><button class="btn small danger" data-act="delBazar" data-id="' + b.id + '">মুছুন</button></td></tr>';
      });
      h += '</tbody><tfoot><tr><td colspan="3">মোট বাজার</td><td class="n">' + f2(c.totalBazar) + '</td><td></td></tr></tfoot></table></div>';
    }
    return h + '</section>';
  }

  function viewKharoch() {
    var h = '<section class="panel"><h2>নির্ধারিত খরচ</h2><p class="hint">বাসা ভাড়া সদস্য বিভাগে প্রত্যেকের নামে লিখুন। এখানে অন্যান্য খরচ যোগ করুন। “সমান ভাগ” হলে সবাই সমান দেবেন, “আলাদা পরিমাণ” হলে প্রত্যেকের জন্য আলাদা টাকা লিখুন।</p>';
    if (!S.members.length) h += '<p class="warn">আলাদা পরিমাণ দিতে হলে আগে সদস্য বিভাগে সদস্য যোগ করুন।</p>';
    h += '<div class="tablewrap"><table><thead><tr><th>খরচের নাম</th><th>ভাগের নিয়ম</th><th class="n">টাকা</th><th></th></tr></thead><tbody>';
    S.fixed.forEach(function (x) {
      var cust = x.split === 'custom';
      h += '<tr><td>' + (x.locked ? '<span class="name">' + esc(x.name) + '</span>' : '<input class="inp" type="text" maxlength="40" data-f="fname" data-id="' + x.id + '" value="' + esc(x.name) + '" aria-label="খরচের নাম">') + '</td>' +
        '<td><select class="inp" data-f="fsplit" data-id="' + x.id + '" aria-label="ভাগের নিয়ম"><option value="equal"' + (cust ? '' : ' selected') + '>সমান ভাগ</option><option value="custom"' + (cust ? ' selected' : '') + '>আলাদা পরিমাণ</option></select></td>';
      if (cust) h += '<td class="n" data-live="fitem" data-id="' + x.id + '"></td>';
      else h += '<td class="n"><input class="inp num" type="number" inputmode="decimal" min="0" step="any" data-f="famt" data-id="' + x.id + '" value="' + (x.amount || '') + '" placeholder="০" style="width:120px" aria-label="টাকা"></td>';
      h += '<td>' + (x.locked ? '' : '<button class="btn small danger" data-act="delFixed" data-id="' + x.id + '">মুছুন</button>') + '</td></tr>';
      if (cust && S.members.length) {
        h += '<tr><td colspan="4" style="background:var(--bg)"><div class="row">';
        S.members.forEach(function (m) {
          var v = (x.custom && x.custom[m.id]) || '';
          h += '<div class="field"><label for="fc-' + x.id + m.id + '">' + esc(m.name) + '</label><input id="fc-' + x.id + m.id + '" class="inp num" type="number" inputmode="decimal" min="0" step="any" data-f="fcust" data-id="' + x.id + '" data-m="' + m.id + '" value="' + v + '" placeholder="০" style="width:100px"></div>';
        });
        h += '</div></td></tr>';
      }
    });
    h += '</tbody><tfoot><tr><td colspan="2">মোট নির্ধারিত খরচ</td><td class="n" id="fxTotal"></td><td></td></tr></tfoot></table></div>';
    h += '<h3 style="font-size:15px">সদস্যপ্রতি নির্ধারিত খরচ</h3><div class="chips">' + S.members.map(function (m) { return '<span class="chip">' + esc(m.name) + ' <b data-live="mfix" data-m="' + m.id + '"></b></span>'; }).join('') + '</div>';
    h += '<div class="row"><div class="field" style="flex:1 1 180px"><label for="nfName">নতুন খরচ</label><input id="nfName" class="inp" type="text" maxlength="40" placeholder="যেমন: মেরামত খরচ"></div>' +
      '<div class="field"><label for="nfSplit">ভাগের নিয়ম</label><select id="nfSplit" class="inp"><option value="equal">সমান ভাগ</option><option value="custom">আলাদা পরিমাণ</option></select></div>' +
      '<div class="field"><label for="nfAmt">টাকা (সমান ভাগ হলে)</label><input id="nfAmt" class="inp num" type="number" inputmode="decimal" min="0" step="any" placeholder="০" style="width:110px"></div>' +
      '<button class="btn primary" data-act="addFixed">যোগ করুন</button></div></section>';
    return h;
  }

  function viewMember() {
    var h = '<section class="panel"><h2>সদস্য</h2><p class="hint">সদস্যদের তালিকার ক্রম অনুযায়ী প্রতি ৬ দিনে বাজারের পালা নির্ধারিত হয়। সর্বোচ্চ ৫ জন যোগ করা যাবে।</p>';
    if (!S.members.length) h += '<p class="hint">এখনো কোনো সদস্য যোগ করা হয়নি।</p>';
    else {
      h += '<div class="tablewrap"><table><thead><tr><th class="n">ক্রম</th><th>নাম</th><th class="n">বাসা ভাড়া (৳)</th><th>পালার ক্রম</th><th></th></tr></thead><tbody>';
      S.members.forEach(function (m, index) {
        h += '<tr><td class="n">' + (index + 1).toLocaleString('bn-BD') + '</td><td><input class="inp" type="text" maxlength="30" data-f="mname" data-id="' + m.id + '" value="' + esc(m.name) + '" aria-label="সদস্যের নাম"></td>' +
          '<td class="n"><input class="inp num" type="number" inputmode="decimal" min="0" step="any" data-f="mrent" data-id="' + m.id + '" value="' + (m.rent || '') + '" placeholder="০" style="width:120px" aria-label="বাসা ভাড়া"></td>' +
          '<td><button class="btn small" data-act="moveMember" data-dir="-1" data-id="' + m.id + '" aria-label="' + esc(m.name) + ' উপরে নিন"' + (index === 0 ? ' disabled' : '') + '>↑</button> <button class="btn small" data-act="moveMember" data-dir="1" data-id="' + m.id + '" aria-label="' + esc(m.name) + ' নিচে নিন"' + (index === S.members.length - 1 ? ' disabled' : '') + '>↓</button></td>' +
          '<td><button class="btn small danger" data-act="delMember" data-id="' + m.id + '">মুছুন</button></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    if (S.members.length < 5) h += '<div class="row"><div class="field" style="flex:1 1 200px"><label for="nmName">নতুন সদস্যের নাম</label><input id="nmName" class="inp" type="text" maxlength="30" placeholder="নাম লিখুন"></div><button class="btn primary" data-act="addMember">সদস্য যোগ করুন</button></div>';
    else h += '<p class="hint">৫ জন সদস্য যোগ হয়েছে।</p>';
    return h + '</section>';
  }

  /* ---------- render ---------- */
  function refreshLive() {
    var c = calc();
    var q = function (s) { return document.querySelectorAll('[data-live="' + s + '"]'); };
    var dm = {}, db = {};
    Object.keys(S.meals).forEach(function (d) { var t = 0; S.members.forEach(function (m) { t += mealCount(S.meals[d][m.id]); }); dm[d] = t; });
    S.bazar.forEach(function (b) { db[b.day] = (db[b.day] || 0) + b.amount; });
    q('dmeal').forEach(function (e) { var v = dm[e.dataset.d] || 0; e.textContent = v ? fm(v) : ''; });
    q('dbazar').forEach(function (e) { var v = db[e.dataset.d] || 0; e.textContent = v ? f2(v) : ''; });
    q('mmeal').forEach(function (e) { var r = c.rows.filter(function (x) { return x.id === e.dataset.m; })[0]; e.textContent = r ? fm(r.meals) : ''; });
    q('tmeal').forEach(function (e) { e.textContent = fm(c.totalMeal); });
    q('tbazar').forEach(function (e) { e.textContent = f2(c.totalBazar); });
    if ($('fxTotal')) $('fxTotal').textContent = f2(c.fixedTotal);
    q('fitem').forEach(function (e) { var x = S.fixed.filter(function (y) { return y.id === e.dataset.id; })[0]; e.textContent = x ? f2(fixedAmount(x)) : ''; });
    q('mfix').forEach(function (e) { var r = c.rows.filter(function (y) { return y.id === e.dataset.m; })[0]; e.textContent = r ? f2(r.share) : ''; });
  }
  function renderView() {
    var v = tab === 'hishab' ? viewHishab() : tab === 'meal' ? viewMeal() : tab === 'bazar' ? viewBazar() : tab === 'kharoch' ? viewKharoch() : viewMember();
    $('view').innerHTML = v; refreshLive();
  }
  function renderAll() {
    $('monthLabel').textContent = label(ym);
    $('messName').value = S.name || '';
    document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    renderView();
  }
  function commit() { queueSave(); }

  window.addEventListener('pagehide', function () {
    if (!S) return;
    clearTimeout(saveTimer);
    try { localStorage.setItem('mess:' + ym, JSON.stringify(S)); } catch (e) {}
  });

  /* ---------- events ---------- */
  $('messName').addEventListener('input', function (e) { S.name = e.target.value; commit(); });

  $('view').addEventListener('input', function (e) {
    var t = e.target, f = t.dataset.f; if (!f) return;
    if (f === 'meal') {
      var d = t.dataset.d, v = num(t.value);
      if (!S.meals[d]) S.meals[d] = {};
      var meal = S.meals[d][t.dataset.m];
      if (typeof meal !== 'object' || !meal) meal = { breakfast: 0, lunch: 0, dinner: 0 };
      meal[t.dataset.slot] = v;
      if (mealCount(meal) > 0) S.meals[d][t.dataset.m] = meal; else delete S.meals[d][t.dataset.m];
    } else if (f === 'mname') {
      S.members.forEach(function (m) { if (m.id === t.dataset.id) m.name = t.value; });
    } else if (f === 'mrent') {
      S.members.forEach(function (m) { if (m.id === t.dataset.id) m.rent = num(t.value); });
    } else if (f === 'mjoma') {
      S.members.forEach(function (m) { if (m.id === t.dataset.id) m.joma = num(t.value); });
    } else if (f === 'fname') {
      S.fixed.forEach(function (x) { if (x.id === t.dataset.id) x.name = t.value; });
    } else if (f === 'famt') {
      S.fixed.forEach(function (x) { if (x.id === t.dataset.id) x.amount = num(t.value); });
    } else if (f === 'fcust') {
      S.fixed.forEach(function (x) { if (x.id === t.dataset.id) { if (!x.custom) x.custom = {}; x.custom[t.dataset.m] = num(t.value); } });
    } else if (f === 'fsplit') {
      S.fixed.forEach(function (x) { if (x.id === t.dataset.id) x.split = t.value === 'custom' ? 'custom' : 'equal'; });
      commit(); renderView(); return;
    }
    refreshLive(); commit();
  });

  document.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'theme') {
      var isDark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var nextTheme = isDark ? 'light' : 'dark';
      document.documentElement.dataset.theme = nextTheme;
      try { localStorage.setItem('mess-theme', nextTheme); } catch (err) {}
      toast(nextTheme === 'dark' ? 'ডার্ক মোড চালু হয়েছে' : 'লাইট মোড চালু হয়েছে');
      return;
    }
    if (a === 'backup') { await exportBackup(); return; }
    if (a === 'restore') { $('restoreFile').click(); return; }
    if (a === 'tab') { tab = b.dataset.tab; renderAll(); return; }
    if (a === 'toggleMemberSummary') { S.showMemberSummary = S.showMemberSummary !== true; commit(); renderView(); return; }
    if (a === 'prev' || a === 'next') {
      await doSave();
      await loadMonth(shift(ym, a === 'next' ? 1 : -1));
      dashboardDay = null;
      renderAll(); return;
    }
    if (a === 'addMember') {
      var nm = $('nmName').value.trim(); if (!nm) { toast('সদস্যের নাম লিখুন'); return; }
      if (S.members.length >= 5) { toast('সর্বোচ্চ ৫ জন সদস্য যোগ করা যাবে।'); return; }
      S.members.push({ id: uid(), name: nm, joma: 0, rent: 0 }); saveMarketOrder(); commit(); renderView(); if ($('nmName')) $('nmName').focus(); return;
    }
    if (a === 'delMember') {
      var id = b.dataset.id;
      if (S.bazar.some(function (x) { return x.mid === id; })) { toast('এই সদস্যের বাজারের তথ্য আছে। আগে বাজার বিভাগ থেকে সেগুলো মুছুন।'); return; }
      S.members = S.members.filter(function (m) { return m.id !== id; });
      Object.keys(S.meals).forEach(function (d) { delete S.meals[d][id]; });
      saveMarketOrder(); commit(); renderView(); return;
    }
    if (a === 'moveMember') {
      var fromIndex = S.members.findIndex(function (m) { return m.id === b.dataset.id; });
      var toIndex = fromIndex + Number(b.dataset.dir);
      if (fromIndex < 0 || toIndex < 0 || toIndex >= S.members.length) return;
      var moving = S.members[fromIndex];
      S.members.splice(fromIndex, 1); S.members.splice(toIndex, 0, moving);
      saveMarketOrder(); commit(); renderView(); return;
    }
    if (a === 'addBazar') {
      var marketDay = $('bzDay') ? Number($('bzDay').value) : 0;
      var member = Number.isInteger(marketDay) && marketDay >= 1 && marketDay <= dim(ym) ? bazarAssignee(marketDay) : null;
      var amt = num($('bzAmt').value);
      if (S.members.length !== 5 || !member) { toast('পাঁচজন সদস্য যোগ করার পর নির্ধারিত বাজারের দিন বেছে নিন।'); return; }
      if (!amt) { toast('টাকার পরিমাণ লিখুন'); return; }
      S.bazar.push({ id: uid(), day: marketDay, mid: member.id, amount: amt, note: $('bzNote').value.trim() });
      commit(); var keepDay = $('bzDay').value; renderView(); $('bzDay').value = keepDay; $('bzAmt').focus(); return;
    }
    if (a === 'delBazar') {
      var entry = S.bazar.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (!entry) return;
      S.bazar = S.bazar.filter(function (x) { return x.id !== b.dataset.id; }); commit(); renderView(); return;
    }
    if (a === 'addFixed') {
      var fn = $('nfName').value.trim(); if (!fn) { toast('খরচের নাম লিখুন'); return; }
      S.fixed.push({ id: uid(), name: fn, amount: num($('nfAmt').value), split: $('nfSplit').value === 'custom' ? 'custom' : 'equal', custom: {} }); commit(); renderView(); $('nfName').focus(); return;
    }
    if (a === 'delFixed') {
      if (S.fixed.some(function (x) { return x.id === b.dataset.id && x.locked; })) return;
      S.fixed = S.fixed.filter(function (x) { return x.id !== b.dataset.id; }); commit(); renderView(); return;
    }
    if (a === 'xlsx') { exportXlsx(); return; }
    if (a === 'pdf') { exportPdf(); return; }
  });

  $('view').addEventListener('change', async function (e) {
    if (e.target.id === 'summaryDay') { dashboardDay = Number(e.target.value); renderView(); return; }
    if (e.target.id === 'bzDay') {
      var assigned = bazarAssignee(Number(e.target.value));
      $('bzAssignee').innerHTML = 'এই তারিখে বাজারের দায়িত্ব: <b>' + esc(assigned ? assigned.name : '?') + '</b>';
      return;
    }
    if (e.target.id !== 'restoreFile' || !e.target.files || !e.target.files[0]) return;
    var file = e.target.files[0];
    try {
      var pack = JSON.parse(await file.text());
      if (!pack || pack.app !== 'mess-hishab' || !pack.months || typeof pack.months !== 'object') throw new Error('format');
      var keys = Object.keys(pack.months);
      if (!keys.length || keys.some(function (k) { var st = pack.months[k]; return !/^\d{4}-\d{2}$/.test(k) || !st || !Array.isArray(st.members) || !Array.isArray(st.bazar) || !st.meals || !Array.isArray(st.fixed); })) throw new Error('data');
      if (!window.confirm(keys.length.toLocaleString('bn-BD') + ' মাসের তথ্য ফিরিয়ে আনা হবে। একই মাসের পুরোনো তথ্য বদলে যেতে পারে। চালিয়ে যাবেন?')) return;
      for (var ri = 0; ri < keys.length; ri++) {
        var rk = keys[ri], rjson = JSON.stringify(pack.months[rk]);
        localStorage.setItem('mess:' + rk, rjson);
        if (dbNS) { try { await dbNS.doc('months/' + rk).set({ json: rjson, updated: Date.now() }); } catch (dbErr) {} }
      }
      await loadMonth(ym); renderAll(); setStatus('ব্যাকআপ ফিরিয়ে আনা হয়েছে'); toast('ব্যাকআপ ফিরিয়ে আনা হয়েছে');
    } catch (err) { toast('ব্যাকআপ ফাইলটি সঠিক নয় বা সেভ করা যায়নি।'); }
    e.target.value = '';
  });

  /* ---------- export ---------- */
  async function saveFile(name, data) {
    if (dlNS) {
      try { await dlNS.save({ filename: name, data: data }); toast('ফাইল তৈরি হয়েছে: ' + name); return; }
      catch (err) { if (err && err.code === 'declined') return; }
    }
    try {
      var blob = data instanceof Blob ? data : new Blob([data], { type: name.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
      var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); toast('ডাউনলোড শুরু হয়েছে');
    } catch (err) { toast('ডাউনলোড হয়নি, আবার চেষ্টা করুন।'); }
  }
  async function exportBackup() {
    await doSave();
    var months = {};
    try { for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); if (key && /^mess:\d{4}-\d{2}$/.test(key)) { var mk = key.slice(5); months[mk] = JSON.parse(localStorage.getItem(key)); } } } catch (e) {}
    months[ym] = S;
    var pack = { app: 'mess-hishab', version: 1, createdAt: new Date().toISOString(), months: months };
    await saveFile('mess-backup-' + ym + '.json', JSON.stringify(pack, null, 2));
  }
  function mealRows(c) {
    var out = [];
    for (var d = 1; d <= dim(ym); d++) {
      var row = [dayLabel(d)], t = 0;
      S.members.forEach(function (m) { var v = mealCount(S.meals[d] && S.meals[d][m.id]); t += v; row.push(v || ''); });
      var bz = S.bazar.filter(function (x) { return x.day === d; }).reduce(function (a, x) { return a + x.amount; }, 0);
      row.push(t || ''); row.push(bz ? r2(bz) : ''); out.push(row);
    }
    return out;
  }
  function exportXlsx() {
    if (!window.XLSX) { toast('এক্সেল লাইব্রেরি লোড হয়নি। পেজটি আবার খুলুন।'); return; }
    var c = calc(), t = label(ym), wb = XLSX.utils.book_new();
    var sum = [[S.name + ' - মাসিক হিসাব - ' + t], [], ['মোট বাজার (৳)', r2(c.totalBazar)], ['মোট মিল', r2(c.totalMeal)], ['মিলের দর (৳)', r2(c.rate)], ['মোট বাসা ভাড়া (৳)', r2(c.rentTotal)], ['অন্যান্য নির্ধারিত খরচ (৳)', r2(c.fixedTotal)], ['সদস্য সংখ্যা', c.n], ['নির্ধারিত খরচ জনপ্রতি (৳)', r2(c.share)], [],
      ['সদস্য', 'বাসা ভাড়া', 'মিল', 'মিলের খরচ', 'অন্যান্য নির্ধারিত', 'মোট বিল', 'বাজার করেছেন', 'জমা', 'দেবেন (+) / পাবেন (-)']];
    c.rows.forEach(function (r) { sum.push([r.name, r2(r.rent), r2(r.meals), r2(r.mealCost), r2(r.share), r2(r.bill), r2(r.spent), r2(r.joma), r2(-r.balance)]); });
    sum.push(['মোট', r2(c.rentTotal), r2(c.totalMeal), r2(c.totalBazar), r2(c.fixedTotal), r2(c.rentTotal + c.totalBazar + c.fixedTotal), r2(c.totalBazar), r2(S.members.reduce(function (a, m) { return a + m.joma; }, 0)), '']);
    var w1 = XLSX.utils.aoa_to_sheet(sum); w1['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, w1, 'হিসাব');
    var mh = ['দিন'].concat(S.members.map(function (m) { return m.name; }), ['মিল', 'বাজার']);
    var w2 = XLSX.utils.aoa_to_sheet([mh].concat(mealRows(c))); w2['!cols'] = [{ wch: 14 }];
    XLSX.utils.book_append_sheet(wb, w2, 'মিল');
    var bz = [['তারিখ', 'সদস্য', 'কেনাকাটা', 'টাকা']];
    S.bazar.slice().sort(function (a, b) { return a.day - b.day; }).forEach(function (b) { bz.push([dayLabel(b.day), memberName(b.mid), b.note || '', r2(b.amount)]); });
    bz.push(['মোট', '', '', r2(c.totalBazar)]);
    var w3 = XLSX.utils.aoa_to_sheet(bz); w3['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, w3, 'বাজার');
    var fx = [['খরচ', 'মোট'].concat(S.members.map(function (m) { return m.name; }))];
    S.fixed.forEach(function (x) { fx.push([x.name, r2(fixedAmount(x))].concat(S.members.map(function (m) { return r2(fixedFor(x, m)); }))); });
    fx.push(['মোট', r2(c.fixedTotal)].concat(c.rows.map(function (r) { return r2(r.share); })));
    var w4 = XLSX.utils.aoa_to_sheet(fx); w4['!cols'] = [{ wch: 24 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, w4, 'নির্ধারিত খরচ');
    saveFile('mess-hishab-' + ym + '.xlsx', XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  }
  function exportPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('পিডিএফ লাইব্রেরি লোড হয়নি। পেজটি আবার খুলুন।'); return; }
    var c = calc(), t = label(ym);
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: S.members.length > 7 ? 'l' : 'p' });
    if (typeof doc.autoTable !== 'function') { toast('পিডিএফ টেবিল লাইব্রেরি লোড হয়নি। পেজটি আবার খুলুন।'); return; }
    var accent = [192, 86, 26];
    doc.setFontSize(18); doc.text((S.name || 'মেস') + ' - মাসিক হিসাব', 40, 48);
    doc.setFontSize(11); doc.setTextColor(90); doc.text(t, 40, 66); doc.setTextColor(0);
    doc.autoTable({ startY: 80, theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: accent },
      head: [['মোট বাজার', 'মোট মিল', 'মিলের দর', 'বাসা ভাড়া', 'অন্যান্য খরচ']],
      body: [[f2(c.totalBazar) + ' ৳', fm(c.totalMeal), f2(c.rate) + ' ৳', f2(c.rentTotal) + ' ৳', f2(c.fixedTotal) + ' ৳']] });
    var body = c.rows.map(function (r) { return [r.name, f2(r.rent), fm(r.meals), f2(r.mealCost), f2(r.share), f2(r.bill), f2(r.spent), f2(r.joma), (r.balance >= 0 ? 'পাবেন ' : 'দেবেন ') + f2(Math.abs(r.balance))]; });
    body.push(['মোট', f2(c.rentTotal), fm(c.totalMeal), f2(c.totalBazar), f2(c.fixedTotal), f2(c.rentTotal + c.totalBazar + c.fixedTotal), f2(c.totalBazar), f2(S.members.reduce(function (a, m) { return a + m.joma; }, 0)), '']);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 18, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: accent },
      head: [['সদস্য', 'বাসা ভাড়া', 'মিল', 'মিলের খরচ', 'অন্যান্য খরচ', 'মোট বিল', 'বাজার করেছেন', 'জমা', 'অবস্থা']], body: body,
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
      didParseCell: function (d) { if (d.row.index === body.length - 1) d.cell.styles.fontStyle = 'bold'; } });
    var fb = S.fixed.map(function (x) { return [x.name, f2(fixedAmount(x))].concat(S.members.map(function (m) { return f2(fixedFor(x, m)); })); });
    fb.push(['মোট', f2(c.fixedTotal)].concat(c.rows.map(function (r) { return f2(r.share); })));
    var fcs = {}; for (var ci = 1; ci <= S.members.length + 1; ci++) fcs[ci] = { halign: 'right' };
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 18, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: accent },
      head: [['নির্ধারিত খরচ', 'মোট'].concat(S.members.map(function (m) { return m.name; }))], body: fb, columnStyles: fcs,
      didParseCell: function (d) { if (d.row.index === fb.length - 1) d.cell.styles.fontStyle = 'bold'; } });
    if (S.bazar.length) {
      doc.addPage();
      var bb = S.bazar.slice().sort(function (a, b) { return a.day - b.day; }).map(function (b) { return [dayLabel(b.day), memberName(b.mid), b.note || '', f2(b.amount)]; });
      bb.push(['মোট', '', '', f2(c.totalBazar)]);
      doc.setFontSize(13); doc.text('বাজারের তালিকা', 40, 48);
      doc.autoTable({ startY: 58, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: accent },
        head: [['তারিখ', 'সদস্য', 'কেনাকাটা', 'টাকা']], body: bb, columnStyles: { 3: { halign: 'right' } },
        didParseCell: function (d) { if (d.row.index === bb.length - 1) d.cell.styles.fontStyle = 'bold'; } });
    }
    if (S.members.length) {
      doc.addPage();
      doc.setFontSize(13); doc.text('প্রতিদিনের মিল', 40, 48);
      var mr = mealRows(c);
      var tot = ['মোট'].concat(c.rows.map(function (r) { return fm(r.meals); }), [fm(c.totalMeal), f2(c.totalBazar)]);
      mr.push(tot);
      doc.autoTable({ startY: 58, theme: 'grid', styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: accent },
        head: [['দিন'].concat(S.members.map(function (m) { return m.name; }), ['মিল', 'বাজার'])], body: mr,
        didParseCell: function (d) { if (d.row.index === mr.length - 1) d.cell.styles.fontStyle = 'bold'; } });
    }
    saveFile('mess-hishab-' + ym + '.pdf', doc.output('arraybuffer'));
  }

  /* ---------- boot ---------- */
  async function boot() {
    try { var savedTheme = localStorage.getItem('mess-theme'); if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme; } catch (e) {}
    try {
      if (window.claude && window.claude.use) {
        dbNS = await window.claude.use('db');
        dlNS = await window.claude.use('downloads');
      }
    } catch (e) {}
    await loadMonth(ym);
    try { localStorage.removeItem('mess-users'); localStorage.removeItem('mess-session'); } catch (e) {}
    renderAll();
    setStatus(dbNS ? 'তথ্য সেভ হচ্ছে' : 'এই ব্রাউজারে তথ্য সেভ হবে');
  }
  boot();
})();
