(function () {
  var MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  var DAYS = ['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি'];
  var $ = function (id) { return document.getElementById(id); };
  var now = new Date();
  var startYm = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var ym = startYm, S = null, tab = 'hishab', dashboardDay = null, dbNS = null, authNS = null, currentUser = null, currentProfile = null, profileSetup = false, loadedUid = '', creatingAccount = false, dlNS = null, saveTimer = null, toastTimer = null, pendingMealEntries = {}, mealEntryDocs = {}, marketUsers = [], marketTurnCorrections = {}, correctingOctober31Turn = false, mealEntriesNeedSync = false, auditLogs = [], auditLoading = false, auditError = '', editingBazarId = '', pendingDeleteButton = null, confirmedDeleteButton = null, reportMonths = [], reportsLoading = false, reportsError = '', selectedReportMonth = '';
  var MARKET_ORDER_KEY = 'mess-market-order-v3';
  var externalScriptLoads = {};
  var PREFERRED_MARKET_ORDER = ['Tasik Adnan', 'Shoumik Saha', 'Ashim Bhowmik', 'Gopal Roy', 'Rahul Basak Santo'];

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function displayName(value) {
    var name = String(value || '').trim().replace(/\s+/g, ' ');
    var canonicalNames = {
      rahulbasaksanto: 'Rahul Basak Santo',
      tasikadnan: 'Tasik Adnan',
      tasik: 'Tasik Adnan',
      shoumiksaha: 'Shoumik Saha',
      shuomiksaha: 'Shoumik Saha',
      shoumik: 'Shoumik Saha',
      ashimbhowmik: 'Ashim Bhowmik',
      ashimbhuomik: 'Ashim Bhowmik',
      ashimbhoumik: 'Ashim Bhowmik',
      ashim: 'Ashim Bhowmik',
      gopal: 'Gopal Roy',
      gopalroy: 'Gopal Roy'
    };
    return canonicalNames[normalizeMemberName(name)] || name;
  }
  function deleteConfirmationText(button) {
    var action = button.dataset.act, detail = '';
    if (action === 'delMember') {
      var member = S.members.filter(function (item) { return item.id === button.dataset.id; })[0];
      detail = member ? ' ' + displayName(member.name) + ' সদস্যকে' : ' এই সদস্যকে';
    } else if (action === 'delBazar') {
      detail = ' এই বাজারের খরচটি';
    } else if (action === 'delFixed') {
      var fixed = S.fixed.filter(function (item) { return item.id === button.dataset.id; })[0];
      detail = fixed ? ' “' + fixed.name + '” খরচটি' : ' এই খরচটি';
    } else if (action === 'delMarketTurnBlock') {
      var range = marketTurnBlockRange(Number(button.dataset.block), dim(ym));
      detail = range ? ' ' + range.start.toLocaleString('bn-BD') + '–' + range.end.toLocaleString('bn-BD') + ' তারিখের বাজারের পালাটি' : ' এই বাজারের পালাটি';
    } else if (action === 'deleteDailyMenu') {
      detail = ' ' + Number(button.dataset.day).toLocaleString('bn-BD') + ' তারিখের মেনুটি';
    } else if (action === 'deleteFixedReport') {
      return 'এই মাসের নির্ধারিত খরচের রিপোর্টটি ড্যাশবোর্ড থেকে অপ্রকাশিত করতে চান? পরে আবার প্রকাশ করা যাবে।';
    }
    return 'আপনি কি নিশ্চিত যে' + detail + ' মুছে ফেলতে চান? এই কাজটি ফিরিয়ে নেওয়া যাবে না।';
  }
  function openDeleteConfirmation(button) {
    pendingDeleteButton = button;
    $('confirmMessage').textContent = deleteConfirmationText(button);
    var overlay = $('confirmOverlay');
    overlay.hidden = false;
    requestAnimationFrame(function () {
      overlay.classList.add('is-open');
      overlay.querySelector('[data-act="cancelDelete"]').focus();
    });
  }
  function closeDeleteConfirmation() {
    var overlay = $('confirmOverlay');
    overlay.classList.remove('is-open');
    overlay.hidden = true;
    pendingDeleteButton = null;
  }
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
  function auditSnapshot(entry) {
    return { day: entry.day, member: memberName(entry.mid), amount: entry.amount, note: entry.note || '' };
  }
  function canManageBazarDay(day) {
    if (window.isAdmin) return true;
    var turn = marketTurn(day);
    return Boolean(currentUser && turn && turn.uid === currentUser.uid);
  }
  function canManageBazarEntry(entry) {
    return Boolean(entry && window.isAdmin);
  }
  function bazarEntryDocId(month, id) {
    return month + '_' + String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  }
  function mealEntryDocId(month, day, memberId, slot) {
    return month + '_' + day + '_' + memberId + '_' + slot;
  }
  function mealSnapshot(entry) {
    return entry ? { value: entry.value } : null;
  }
  function queueMealChange(month, day, memberId, slot, value, legacyValue) {
    var entryId = mealEntryDocId(month, day, memberId, slot);
    var queued = pendingMealEntries[entryId];
    var stored = mealEntryDocs[entryId] || null;
    var turn = marketTurn(Number(day));
    var before = queued ? queued.before : stored || (legacyValue > 0 ? {
      month: month, day: String(day), memberId: memberId, slot: slot, value: legacyValue,
      uid: turn && turn.uid || currentUser.uid
    } : null);
    var after = value > 0 ? {
      month: month, day: String(day), memberId: memberId, slot: slot, value: value,
      uid: before && before.uid || turn && turn.uid || currentUser.uid
    } : null;
    if (!before && !after) { delete pendingMealEntries[entryId]; return; }
    if (before && after && Number(before.value) === Number(after.value)) {
      delete pendingMealEntries[entryId];
      return;
    }
    pendingMealEntries[entryId] = {
      entryId: entryId, before: before, after: after,
      legacyOnly: queued ? queued.legacyOnly : !stored && Boolean(legacyValue > 0)
    };
  }
  async function syncPendingMealChanges(month) {
    var pendingIds = Object.keys(pendingMealEntries);
    for (var offset = 0; offset < pendingIds.length; offset += 200) {
      var batch = dbNS.batch();
      var chunk = pendingIds.slice(offset, offset + 200);
      chunk.forEach(function (entryId) {
        var change = pendingMealEntries[entryId], before = change.before, after = change.after;
        if (!before && !after) return;
        var action = !before ? 'meal_add' : !after ? 'meal_delete' : 'meal_edit';
        var logId;
        if (action === 'meal_delete') logId = before.nextAuditId || ('meal_delete_' + entryId + '_' + currentUser.uid);
        else if (action === 'meal_edit' && before.nextAuditId) logId = before.nextAuditId;
        else logId = uid() + uid();
        if (after || change.legacyOnly) {
          if (!after) {
            after = Object.assign({}, before, { value: 0 });
            change.persistedTombstone = after;
          }
          after.auditId = logId;
          after.nextAuditId = uid() + uid();
        }
        var snapshot = after || before;
        batch.set(dbNS.collection('auditLogs').doc(logId), {
          actorUid: currentUser.uid,
          actorName: currentProfile && currentProfile.name || currentUser.email || 'অজানা',
          actorEmail: currentUser.email || '',
          action: action,
          month: month,
          day: String(snapshot.day),
          member: memberName(snapshot.memberId),
          memberId: snapshot.memberId,
          entryId: entryId,
          amount: Number(snapshot.value) || 0,
          note: snapshot.slot,
          before: mealSnapshot(before),
          after: mealSnapshot(change.persistedTombstone || after) || {},
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        var ref = dbNS.collection('mealEntries').doc(entryId);
        if (change.legacyOnly) batch.set(ref, after);
        else if (!before) batch.set(ref, after);
        else if (!after) batch.delete(ref);
        else batch.update(ref, { value: after.value, auditId: after.auditId, nextAuditId: after.nextAuditId });
      });
      await batch.commit();
      chunk.forEach(function (entryId) {
        var change = pendingMealEntries[entryId];
        if (change.after || change.persistedTombstone) mealEntryDocs[entryId] = Object.assign({}, change.after || change.persistedTombstone);
        else delete mealEntryDocs[entryId];
        delete pendingMealEntries[entryId];
      });
    }
  }
  async function persistBazarChange(action, before, after) {
    if (!dbNS || !currentUser) throw new Error('Firebase sign-in is required to create an audit record.');
    var snapshot = after || before;
    var batch = dbNS.batch();
    var entries = dbNS.collection('bazarEntries');
    var entryId = bazarEntryDocId(ym, snapshot.id);
    var logId;
    if (action === 'bazar_add') {
      logId = after.auditId;
      batch.set(entries.doc(entryId), {
        id: snapshot.id, month: ym, day: String(snapshot.day), mid: snapshot.mid,
        amount: snapshot.amount, note: snapshot.note || '', uid: snapshot.uid,
        auditId: after.auditId, nextAuditId: after.nextAuditId
      });
    } else if (action === 'bazar_edit') {
      logId = before.nextAuditId;
      after.auditId = logId;
      after.nextAuditId = uid() + uid();
      batch.update(entries.doc(entryId), {
        amount: after.amount, note: after.note || '',
        auditId: after.auditId, nextAuditId: after.nextAuditId
      });
    } else {
      logId = before.nextAuditId;
      batch.delete(entries.doc(entryId));
    }
    batch.set(dbNS.collection('auditLogs').doc(logId), {
      actorUid: currentUser.uid,
      actorName: currentProfile && currentProfile.name || currentUser.email || 'অজানা',
      actorEmail: currentUser.email || '',
      action: action,
      month: ym,
      day: String(snapshot.day),
      member: memberName(snapshot.mid),
      memberId: snapshot.mid,
      entryId: snapshot.id,
      amount: snapshot.amount,
      note: snapshot.note || '',
      before: before ? auditSnapshot(before) : null,
      after: after ? auditSnapshot(after) : {},
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
    if (action === 'bazar_add') S.bazar.push(after);
    else if (action === 'bazar_edit') {
      S.bazar.forEach(function (entry) {
        if (entry.id === after.id) {
          entry.amount = after.amount; entry.note = after.note;
          entry.auditId = after.auditId; entry.nextAuditId = after.nextAuditId;
        }
      });
    } else S.bazar = S.bazar.filter(function (entry) { return entry.id !== before.id; });
    try { localStorage.setItem('mess:' + ym, JSON.stringify(S)); } catch (storageErr) { console.error('Local market cache update failed:', storageErr); }
  }
  function auditDate(value) {
    if (!value) return 'সময় পাওয়া যায়নি';
    var date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return isNaN(date.getTime()) ? 'সময় পাওয়া যায়নি' : date.toLocaleString('bn-BD');
  }
  function setAuthMode(mode) {
    var createMode = mode === 'register';
    $('registerFields').hidden = !createMode;
    $('authTitle').textContent = createMode ? 'নতুন account তৈরি করুন' : 'লগইন করুন';
    $('authEyebrow').textContent = createMode ? 'শুরু করুন' : 'আবার স্বাগতম';
    $('authDescription').textContent = createMode ? 'আপনার তথ্য দিয়ে account তৈরি করুন। এরপর email ও password দিয়ে লগইন করুন।' : 'চালিয়ে যেতে আপনার ইমেইল ও পাসওয়ার্ড দিন।';
    $('authLoginButton').hidden = createMode;
    $('authRegisterButton').hidden = !createMode;
    $('loginSwitch').hidden = createMode;
    $('registerSwitch').hidden = !createMode;
    $('authPassword').autocomplete = createMode ? 'new-password' : 'current-password';
    $('authMessage').textContent = '';
    $('authMessage').classList.remove('is-success');
  }
  function showProfileForm(user, data, setup) {
    currentUser = user; profileSetup = setup;
    $('authLayout').hidden = true; $('appShell').hidden = true; $('profilePanel').hidden = false;
    $('profileHelp').textContent = setup ? 'আপনার মেস প্রোফাইল তৈরি করতে নাম, মোবাইল নম্বর ও ঠিকানা দিন।' : 'আপনার নাম, মোবাইল নম্বর ও ঠিকানা পরিবর্তন করতে পারবেন। ইমেইল ঠিকানা অপরিবর্তনীয়।';
    var profileDisplayName = displayName((data && data.name) || '');
    $('profileName').value = profileDisplayName;
    $('profileEmail').value = user.email || data && data.email || '';
    $('profileMobile').value = data && data.mobile || '';
    $('profileAddress').value = data && data.address || '';
    $('profileCancel').hidden = setup;
    $('profileMessage').textContent = '';
    var initial = (profileDisplayName || 'ম').trim().charAt(0).toLocaleUpperCase('bn-BD');
    if ($('profileAvatarLarge')) $('profileAvatarLarge').textContent = initial;
    if ($('profileRoleBadge')) {
      var isAdm = Boolean(user && user.email && user.email.toLowerCase() === 'rahulbasak498@gmail.com');
      $('profileRoleBadge').textContent = isAdm ? 'অ্যাডমিন' : 'মেম্বার';
      $('profileRoleBadge').className = 'profile-role-badge ' + (isAdm ? 'is-admin' : 'is-user');
    }
  }
  async function enterApp(user, data) {
    currentUser = user; currentProfile = data;
    $('authLayout').hidden = true; $('profilePanel').hidden = true; $('appShell').hidden = false;
    if (loadedUid === user.uid) return;
    loadedUid = user.uid;
    try {
      await loadMonth(ym);
      renderAll(); setStatus('Firebase-এ তথ্য সেভ হচ্ছে');
      if (window.isAdmin && dbNS) loadMarketUsers(user.uid);
    }
    catch (err) {
      loadedUid = '';
      $('view').innerHTML = '<section class="panel"><h2>হিসাব লোড হয়নি</h2><p class="warn">Firestore Rules প্রকাশিত আছে কি না এবং Firebase সংযোগ ঠিক আছে কি না যাচাই করুন।</p></section>';
      setStatus('Firebase থেকে তথ্য লোড করা যায়নি');
      console.error('Firebase data load failed:', err);
    }
  }
  async function loadMarketUsers(uid) {
    try {
      var usersSnap = await dbNS.collection('users').get();
      if (!currentUser || currentUser.uid !== uid || !window.isAdmin) return;
      marketUsers = usersSnap.docs.map(function (doc) { return { uid: doc.id, name: doc.data().name || '', email: doc.data().email || '' }; });
    } catch (usersErr) {
      if (!currentUser || currentUser.uid !== uid || !window.isAdmin) return;
      marketUsers = [];
      console.error('Market assignee accounts could not be loaded:', usersErr);
    }
    await correctOctober31MarketTurn();
    if (tab === 'bazar') renderView();
  }
  async function handleAuthState(user) {
    if (creatingAccount) return;
    currentUser = user;
    window.isAdmin = Boolean(user && user.email && user.email.toLowerCase() === 'rahulbasak498@gmail.com');
    if (!user) {
      window.isAdmin = false;
      $('authLayout').hidden = false; $('profilePanel').hidden = true; $('appShell').hidden = true;
      return;
    }
    try {
      var snap = await dbNS.collection('users').doc(user.uid).get();
      if (!snap.exists || !snap.data().name || !snap.data().mobile) {
        showProfileForm(user, snap.exists ? snap.data() : null, true);
        return;
      }
      var profileData = snap.data();
      if (Object.prototype.hasOwnProperty.call(profileData, 'nid')) {
        await dbNS.collection('users').doc(user.uid).update({ nid: window.firebase.firestore.FieldValue.delete() });
        delete profileData.nid;
      }
      await enterApp(user, profileData);
    } catch (err) {
      $('authLayout').hidden = false; $('appShell').hidden = true;
      $('authMessage').textContent = 'প্রোফাইল লোড হয়নি। Firestore Rules-এ users collection-এর নিয়ম যোগ করুন।';
      console.error('Firebase profile read failed:', err);
    }
  }
  function memberName(id) { var m = S.members.filter(function (x) { return x.id === id; })[0]; return m ? displayName(m.name) : '?'; }
  function summaryMemberRank(name) {
    var rank = PREFERRED_MARKET_ORDER.map(normalizeMemberName).indexOf(normalizeMemberName(name));
    return rank < 0 ? PREFERRED_MARKET_ORDER.length : rank;
  }
  function marketMemberRank(id) {
    var member = S.members.filter(function (item) { return item.id === id; })[0];
    var rank = member ? summaryMemberRank(member.name) : PREFERRED_MARKET_ORDER.length;
    return rank < 0 ? PREFERRED_MARKET_ORDER.length : rank;
  }
  function compareBazarEntries(a, b) {
    return Number(a.day) - Number(b.day) || marketMemberRank(a.mid) - marketMemberRank(b.mid);
  }
  function mealCount(value) {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'object') return 0;
    return num(value.lunch) + num(value.dinner);
  }
  function currentMonthKey() {
    var date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }
  function isCurrentDate(month, day) {
    return month === currentMonthKey() && Number(day) === new Date().getDate();
  }
  function normalizeMemberName(value) {
    return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      .replace('shuomiksaha', 'shoumiksaha')
      .replace('ashimbhuomik', 'ashimbhowmik')
      .replace('ashimbhoumik', 'ashimbhowmik');
  }
  function marketTurnBlockCount(dayCount) {
    return Math.min(dayCount, S.members.length);
  }
  function marketTurnBlockRange(blockIndex, dayCount, monthKey) {
    var count = marketTurnBlockCount(dayCount);
    if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= count) return null;
    if ((monthKey || ym) === '2026-10' && dayCount === 31 && count === 5) {
      var octoberRanges = [[1, 6], [7, 12], [13, 18], [19, 25], [26, 31]];
      return { start: octoberRanges[blockIndex][0], end: octoberRanges[blockIndex][1] };
    }
    var daysPerMember = Math.floor(dayCount / count), extraDays = dayCount % count;
    var start = blockIndex * daysPerMember + Math.min(blockIndex, extraDays) + 1;
    return { start: start, end: start + daysPerMember + (blockIndex < extraDays ? 0 : -1) };
  }
  function marketTurnBlockForDay(day, dayCount) {
    var count = marketTurnBlockCount(dayCount);
    for (var block = 0; block < count; block++) {
      var range = marketTurnBlockRange(block, dayCount);
      if (day >= range.start && day <= range.end) return block;
    }
    return -1;
  }
  function rebalanceLegacy31DayMarketTurns() {
    if (dim(ym) !== 31 || S.members.length !== 5 || !S.marketTurns) return false;
    var previousAssignments = [], usedMembers = {};
    for (var block = 0; block < 5; block++) {
      var start = block * 6 + 1, end = block === 4 ? 31 : start + 5;
      var assignment = S.marketTurns[String(start)];
      if (!assignment || !assignment.mid || !assignment.uid || usedMembers[assignment.mid]) return false;
      for (var day = start; day <= end; day++) {
        var dayAssignment = S.marketTurns[String(day)];
        if (!dayAssignment || dayAssignment.mid !== assignment.mid || dayAssignment.uid !== assignment.uid) return false;
      }
      usedMembers[assignment.mid] = true;
      previousAssignments.push({ mid: assignment.mid, uid: assignment.uid });
    }
    var alreadyBalanced = true;
    previousAssignments.forEach(function (assignment, blockIndex) {
      var range = marketTurnBlockRange(blockIndex, 31);
      for (var day = range.start; day <= range.end; day++) {
        var dayAssignment = S.marketTurns[String(day)];
        if (!dayAssignment || dayAssignment.mid !== assignment.mid || dayAssignment.uid !== assignment.uid) alreadyBalanced = false;
      }
    });
    if (alreadyBalanced) return false;
    previousAssignments.forEach(function (assignment, blockIndex) {
      var range = marketTurnBlockRange(blockIndex, 31);
      for (var day = range.start; day <= range.end; day++) S.marketTurns[String(day)] = assignment;
    });
    return true;
  }
  function mealSlot(day, memberId, slot) {
    var value = S.meals[day] && S.meals[day][memberId];
    return typeof value === 'object' && value ? (value[slot] || '') : (slot === 'lunch' && value ? value : '');
  }
  function fallbackBazarAssignee(day) {
    if (!S.members.length) return null;
    var block = marketTurnBlockForDay(day, dim(ym));
    return block >= 0 ? S.members[block] : null;
  }
  function marketTurn(day) {
    var turn = S.marketTurns && S.marketTurns[String(day)];
    if (turn && turn.mid) return turn;
    var fallback = fallbackBazarAssignee(day);
    return fallback ? { mid: fallback.id, uid: '' } : null;
  }
  function bazarAssignee(day) {
    var turn = marketTurn(day);
    return turn ? S.members.filter(function (m) { return m.id === turn.mid; })[0] || null : null;
  }
  function marketDayStatus(day, hasEntries) {
    if (!bazarAssignee(day)) return { label: 'পালা নির্ধারিত নয়', style: 'zero' };
    if (hasEntries) return { label: 'বাজার সম্পন্ন', style: 'good' };
    var today = new Date(), currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    if (ym > currentMonth || (ym === currentMonth && day > today.getDate())) return { label: 'সামনে আছে', style: 'zero' };
    if (ym === currentMonth && day === today.getDate()) return { label: 'আজকের পালা', style: 'live' };
    return { label: 'এন্ট্রি বাকি', style: 'zero' };
  }
  function canEditMealOnDay(day) {
    if (window.isAdmin) return true;
    var turn = marketTurn(day);
    return Boolean(isCurrentDate(ym, day) && turn && turn.uid && currentUser && turn.uid === currentUser.uid);
  }
  function applyMarketOrder(st) {
    var order = null;
    try { order = JSON.parse(localStorage.getItem(MARKET_ORDER_KEY) || 'null'); } catch (e) {}
    if (!Array.isArray(order) || !order.length) {
      if (st.members.length !== PREFERRED_MARKET_ORDER.length) return false;
      var byName = {};
      st.members.forEach(function (m) { byName[normalizeMemberName(m.name)] = m; });
      var preferred = PREFERRED_MARKET_ORDER.map(function (name) { return byName[normalizeMemberName(name)]; });
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
    return ['সার্ভিস চার্জ', 'গৃহকর্মীর বেতন', 'ইন্টারনেট বিল', 'ময়লার বিল', 'গ্যাস বিল', 'অন্যান্য খরচ'].map(function (n) {
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
  function blankState() { return { name: 'আমাদের মেস', members: [], meals: {}, bazar: [], dailyMenus: {}, fixed: defaultFixed(), fixedPublished: false, sample: false }; }
  async function readMonth(k) {
    if (dbNS) {
      try {
        var sn = await dbNS.doc('months/' + k).get();
        if (sn.exists) { return JSON.parse(sn.data().json); }
        var localRaw = localStorage.getItem('mess:' + k);
        if (localRaw) {
          var localState = JSON.parse(localRaw);
          if (window.isAdmin) await dbNS.doc('months/' + k).set({ json: localRaw, updated: Date.now() });
          return localState;
        }
      } catch (e) { console.error('Firebase read failed:', e); }
    }
    try { var raw = localStorage.getItem('mess:' + k); if (raw) { return JSON.parse(raw); } } catch (e) {}
    return null;
  }
  async function loadMonth(k) {
    pendingMealEntries = {};
    mealEntryDocs = {};
    marketTurnCorrections = {};
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
    var migrated = migrate(st), reordered = applyMarketOrder(st), migratedBazar = false;
    st.marketTurns = st.marketTurns && typeof st.marketTurns === 'object' ? st.marketTurns : {};
    if (dbNS) {
      var monthReads = await Promise.all([
        dbNS.doc('marketTurns/' + k).get(),
        dbNS.collection('mealEntries').where('month', '==', k).get(),
        dbNS.collection('bazarEntries').where('month', '==', k).get(),
        dbNS.collection('dailyMenus').where('month', '==', k).get()
      ]);
      var turnsSnap = monthReads[0], mealEntriesSnap = monthReads[1], bazarEntriesSnap = monthReads[2], dailyMenusSnap = monthReads[3];
      if (turnsSnap.exists) {
        st.marketTurns = turnsSnap.data().assignments || {};
        marketTurnCorrections = turnsSnap.data().corrections || {};
      }
      mealEntriesSnap.forEach(function (entrySnap) {
        var entry = entrySnap.data();
        mealEntryDocs[entrySnap.id] = Object.assign({}, entry);
        if (!st.meals[entry.day]) st.meals[entry.day] = {};
        var meal = st.meals[entry.day][entry.memberId];
        if (typeof meal !== 'object' || !meal) meal = { breakfast: 0, lunch: 0, dinner: 0 };
        meal[entry.slot] = entry.value;
        st.meals[entry.day][entry.memberId] = meal;
      });
      if (window.isAdmin && st.bazar.length) {
        var oldBazar = st.bazar.slice();
        var knownBazarIds = {};
        bazarEntriesSnap.forEach(function (entrySnap) {
          var data = entrySnap.data();
          knownBazarIds[data.id || entrySnap.id.slice(k.length + 1)] = true;
        });
        var migratedBazarEntries = [];
        for (var bazarOffset = 0; bazarOffset < oldBazar.length; bazarOffset += 200) {
          var bazarBatch = dbNS.batch();
          var batchHasWrites = false;
          oldBazar.slice(bazarOffset, bazarOffset + 200).forEach(function (entry) {
            if (knownBazarIds[entry.id]) return;
            var turn = st.marketTurns[String(entry.day)];
            var auditId = uid() + uid(), nextAuditId = uid() + uid();
            var assignedMember = st.members.filter(function (m) { return m.id === entry.mid; })[0];
            knownBazarIds[entry.id] = true;
            bazarBatch.set(dbNS.collection('bazarEntries').doc(bazarEntryDocId(k, entry.id)), {
              id: entry.id, month: k, day: String(entry.day), mid: entry.mid,
              amount: entry.amount, note: entry.note || '', uid: turn && turn.uid || currentUser.uid,
              auditId: auditId, nextAuditId: nextAuditId
            });
            bazarBatch.set(dbNS.collection('auditLogs').doc(auditId), {
              actorUid: currentUser.uid,
              actorName: currentProfile && currentProfile.name || currentUser.email || 'অজানা',
              actorEmail: currentUser.email || '',
              action: 'bazar_migrate',
              month: k,
              day: String(entry.day),
              member: assignedMember ? assignedMember.name : '?',
              memberId: entry.mid,
              entryId: entry.id,
              amount: entry.amount,
              note: entry.note || '',
              before: null,
              after: { day: entry.day, member: assignedMember ? assignedMember.name : '?', amount: entry.amount, note: entry.note || '' },
              createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
            });
            migratedBazarEntries.push({
              id: entry.id, day: Number(entry.day), mid: entry.mid, amount: entry.amount,
              note: entry.note || '', uid: turn && turn.uid || currentUser.uid,
              auditId: auditId, nextAuditId: nextAuditId
            });
            batchHasWrites = true;
          });
          if (batchHasWrites) await bazarBatch.commit();
        }
        st.bazar = migratedBazarEntries;
        migratedBazar = true;
      } else st.bazar = [];
      st.bazar = bazarEntriesSnap.docs.map(function (entrySnap) {
        var data = entrySnap.data();
        return { id: data.id || entrySnap.id.slice(k.length + 1), day: Number(data.day), mid: data.mid, amount: data.amount, note: data.note || '', uid: data.uid || '', auditId: data.auditId || '', nextAuditId: data.nextAuditId || '' };
      }).concat(st.bazar);
      st.dailyMenus = st.dailyMenus && typeof st.dailyMenus === 'object' ? st.dailyMenus : {};
      dailyMenusSnap.forEach(function (menuSnap) {
        var menu = menuSnap.data();
        st.dailyMenus[String(menu.day)] = { text: menu.menu, uid: menu.uid || '' };
      });
    }
    st.dailyMenus = st.dailyMenus && typeof st.dailyMenus === 'object' ? st.dailyMenus : {};
    S = st; ym = k;
    var turnsRebalanced = window.isAdmin && rebalanceLegacy31DayMarketTurns();
    if (window.isAdmin && (discardSample || migrated || reordered || migratedBazar || turnsRebalanced)) await doSave();
    if (window.isAdmin && marketUsers.length) await correctOctober31MarketTurn();
  }
  async function correctOctober31MarketTurn() {
    var correctionKey = '2026-10-market-turn-order-v2';
    if (!window.isAdmin || !dbNS || !S || ym !== '2026-10' || marketTurnCorrections[correctionKey] || correctingOctober31Turn) return;
    var orderedNames = ['Tasik Adnan', 'Shoumik Saha', 'Ashim Bhowmik', 'Gopal Roy', 'Rahul Basak Santo'];
    var orderedAssignments = [];
    for (var memberIndex = 0; memberIndex < orderedNames.length; memberIndex++) {
      var name = normalizeMemberName(orderedNames[memberIndex]);
      var members = S.members.filter(function (candidate) { return normalizeMemberName(candidate.name) === name; });
      var accounts = marketUsers.filter(function (candidate) { return normalizeMemberName(candidate.name) === name; });
      if (members.length !== 1 || accounts.length !== 1) {
        console.error('October market schedule correction skipped: member and login account must uniquely match ' + orderedNames[memberIndex] + '.');
        return;
      }
      orderedAssignments.push({ mid: members[0].id, uid: accounts[0].uid });
    }
    correctingOctober31Turn = true;
    try {
      var assignments = Object.assign({}, S.marketTurns || {});
      for (var block = 0; block < orderedAssignments.length; block++) {
        var range = marketTurnBlockRange(block, 31, '2026-10');
        for (var day = range.start; day <= range.end; day++) assignments[String(day)] = orderedAssignments[block];
      }
      var corrections = Object.assign({}, marketTurnCorrections);
      corrections[correctionKey] = true;
      await dbNS.doc('marketTurns/' + ym).set({
        assignments: assignments,
        corrections: corrections,
        updated: Date.now()
      }, { merge: true });
      S.marketTurns = assignments;
      marketTurnCorrections = corrections;
      try { localStorage.setItem('mess:' + ym, JSON.stringify(S)); } catch (storageErr) { console.error('Local market-turn correction cache update failed:', storageErr); }
      if (tab === 'bazar') renderView();
    } catch (correctionErr) {
      console.error('October 31 market-turn correction failed:', correctionErr);
      toast('৩১ অক্টোবরের বাজারের পালা আপডেট হয়নি। Firestore Rules ও সংযোগ যাচাই করুন।');
    } finally {
      correctingOctober31Turn = false;
    }
  }
  function migrate(st) {
    var isRent = function (x) { return /basa|bhara|vara/i.test(x.name); };
    var lockedNames = ['সার্ভিস চার্জ', 'গৃহকর্মীর বেতন', 'ইন্টারনেট বিল', 'ময়লার বিল', 'গ্যাস বিল', 'অন্যান্য খরচ'];
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
    if (!st.fixed.some(function (x) { return x.name === 'অন্যান্য খরচ'; })) {
      st.fixed.push({ id: uid(), name: 'অন্যান্য খরচ', amount: 0, split: 'equal', custom: {}, locked: true });
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
  async function syncMealEntries(k, state) {
    var collection = dbNS.collection('mealEntries');
    var oldEntries = await collection.where('month', '==', k).get();
    mealEntryDocs = {};
    for (var offset = 0; offset < oldEntries.docs.length; offset += 450) {
      var deleteBatch = dbNS.batch();
      oldEntries.docs.slice(offset, offset + 450).forEach(function (doc) { deleteBatch.delete(doc.ref); });
      await deleteBatch.commit();
    }
    var records = [];
    Object.keys(state.meals).forEach(function (day) {
      state.members.forEach(function (member) {
        var meal = state.meals[day] && state.meals[day][member.id];
        if (typeof meal === 'number') meal = { breakfast: 0, lunch: meal, dinner: 0 };
        if (!meal || typeof meal !== 'object') return;
        ['breakfast', 'lunch', 'dinner'].forEach(function (slot) {
          var value = num(meal[slot]);
          if (!value) return;
          var turn = state.marketTurns && state.marketTurns[String(day)];
          if (!turn) turn = { uid: '' };
          var id = mealEntryDocId(k, day, member.id, slot);
          var data = {
            month: k, day: String(day), memberId: member.id, slot: slot, value: value,
            uid: turn && turn.uid || currentUser.uid, auditId: uid() + uid(), nextAuditId: uid() + uid()
          };
          records.push({ id: id, data: data });
          mealEntryDocs[id] = Object.assign({}, data);
        });
      });
    });
    for (var writeOffset = 0; writeOffset < records.length; writeOffset += 450) {
      var writeBatch = dbNS.batch();
      records.slice(writeOffset, writeOffset + 450).forEach(function (record) {
        writeBatch.set(collection.doc(record.id), record.data);
      });
      await writeBatch.commit();
    }
  }
  async function doSave() {
    clearTimeout(saveTimer);
    if (!S) return false;
    var k = ym, json = JSON.stringify(S);
    var localSaved = false;
    try { localStorage.setItem('mess:' + k, json); localSaved = true; } catch (e) {}
    if (!dbNS) {
      pendingMealEntries = {};
      setStatus(localSaved ? 'এই ব্রাউজারে সেভ হয়েছে' : 'সেভ হয়নি — স্টোরেজ খালি করুন');
      return localSaved;
    }
    try {
      if (window.isAdmin) {
        var cloudState = Object.assign({}, S, { bazar: [] });
        await dbNS.doc('months/' + k).set({ json: JSON.stringify(cloudState), updated: Date.now() });
        await dbNS.doc('marketTurns/' + k).set({ assignments: S.marketTurns || {}, corrections: marketTurnCorrections, updated: Date.now() });
        await syncPendingMealChanges(k);
        if (mealEntriesNeedSync) {
          await syncMealEntries(k, S);
          mealEntriesNeedSync = false;
        }
      } else {
        await syncPendingMealChanges(k);
      }
      setStatus('তথ্য সেভ হয়েছে');
      if (tab === 'meal') renderView();
      return true;
    } catch (e) {
      setStatus(localSaved ? 'Firebase-এ সেভ হয়নি; এই ব্রাউজারে সেভ হয়েছে' : 'সেভ হয়নি — স্টোরেজ খালি করুন');
      console.error('Firebase data save failed:', e);
      return false;
    }
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
    var dayOptions = '', lunchTotal = 0, dinnerTotal = 0, dailyMarketTotal = 0, dailyMeals = {}, dailyMarket = {}, marketByDay = {};
    for (var date = 1; date <= daysInMonth; date++) dayOptions += '<option value="' + date + '"' + (date === selectedDay ? ' selected' : '') + '>' + dayLabel(date) + '</option>';
    S.members.forEach(function (m) {
      var lunch = num(mealSlot(selectedDay, m.id, 'lunch')), dinner = num(mealSlot(selectedDay, m.id, 'dinner'));
      dailyMeals[m.id] = { lunch: lunch, dinner: dinner };
      lunchTotal += lunch; dinnerTotal += dinner; dailyMarket[m.id] = 0;
    });
    S.bazar.forEach(function (b) {
      marketByDay[b.day] = (marketByDay[b.day] || 0) + b.amount;
      if (b.day === selectedDay) { dailyMarketTotal += b.amount; if (b.mid in dailyMarket) dailyMarket[b.mid] += b.amount; }
    });
    var trendEndDay = ym < currentMonthKey() ? daysInMonth : selectedDay;
    var trendStartDay = Math.max(1, trendEndDay - 6), trendDays = [], trendTotal = 0, trendPeak = 0;
    for (var trendDay = trendStartDay; trendDay <= trendEndDay; trendDay++) {
      var trendAmount = marketByDay[trendDay] || 0;
      trendDays.push({ day: trendDay, amount: trendAmount });
      trendTotal += trendAmount;
      trendPeak = Math.max(trendPeak, trendAmount);
    }
    var selectedMarketEntries = S.bazar.filter(function (entry) { return entry.day === selectedDay; }).sort(compareBazarEntries);
    var selectedAssignee = bazarAssignee(selectedDay), selectedMarketStatus = marketDayStatus(selectedDay, selectedMarketEntries.length > 0);
    var selectedMenu = S.dailyMenus[String(selectedDay)] && S.dailyMenus[String(selectedDay)].text || '';
    var h = S.members.length ? '' : '<section class="welcome-panel"><div class="welcome-icon" aria-hidden="true">✦</div><div><span class="eyebrow">শুরু করুন</span><h2>আপনার মেসের হিসাব তৈরি করুন</h2><p>প্রথমে সদস্যদের নাম ও বাসা ভাড়া যোগ করুন। তারপর মিল ও বাজারের হিসাব রাখুন।</p></div><button class="btn primary" data-act="tab" data-tab="member">সদস্য যোগ করুন <span aria-hidden="true">→</span></button></section>';
    h += '<section class="dashboard-today"><div class="dashboard-today-head"><div><span class="dashboard-eyebrow">দিনের পরিকল্পনা</span><h2>' + dayLabel(selectedDay) + '</h2><p>এই দিনের মিল ও বাজারের দায়িত্ব এক নজরে</p></div><span class="pill ' + selectedMarketStatus.style + '">' + selectedMarketStatus.label + '</span></div>' +
      '<div class="dashboard-focus-grid"><article class="dashboard-focus-card dashboard-menu-card"><span class="dashboard-focus-label">' + (selectedDay === new Date().getDate() && ym === currentMonthKey() ? 'আজকের মেনু' : dayLabel(selectedDay) + ' — মেনু') + '</span><strong>' + (selectedMenu ? esc(selectedMenu) : 'মেনু এখনো দেওয়া হয়নি') + '</strong>' + (selectedMenu ? '' : '<span class="dashboard-focus-note">বাজারের পাতায় মেনু যোগ করা যাবে</span>') + '</article>' +
      '<article class="dashboard-focus-card"><span class="dashboard-focus-label">বাজারের দায়িত্ব</span><strong>' + esc(selectedAssignee ? displayName(selectedAssignee.name) : 'নির্ধারিত নয়') + '</strong><span class="dashboard-focus-note">' + (selectedMarketEntries.length ? 'বাজার এন্ট্রি হয়েছে' : 'এখনো বাজার এন্ট্রি হয়নি') + '</span></article></div>' +
      '<section class="dashboard-market-summary"><div class="dashboard-market-summary-head"><div><span class="dashboard-focus-label">দৈনিক বাজারের সারাংশ</span><strong>' + f2(dailyMarketTotal) + ' ৳</strong></div><span class="pill ' + (selectedMarketEntries.length ? 'good' : 'zero') + '">' + selectedMarketEntries.length.toLocaleString('bn-BD') + 'টি এন্ট্রি</span></div>' +
      (selectedMarketEntries.length
        ? '<ul class="dashboard-market-list">' + selectedMarketEntries.map(function (entry) {
          return '<li><span><b>' + esc(memberName(entry.mid)) + '</b><small>' + esc(entry.note || 'কেনাকাটার বিবরণ নেই') + '</small></span><strong>' + f2(entry.amount) + ' ৳</strong></li>';
        }).join('') + '</ul>'
        : '<p class="dashboard-focus-note">এই তারিখে এখনো কোনো বাজারের খরচ যোগ হয়নি।') + '</section>' +
      '</section>';
    h += '<section class="dashboard-trend" aria-labelledby="dashboardTrendTitle"><div class="dashboard-trend-head"><div><span class="dashboard-eyebrow">খরচের ঝলক</span><h2 id="dashboardTrendTitle">বাজার খরচের ধারা</h2><p class="dashboard-focus-note">' + trendStartDay.toLocaleString('bn-BD') + '–' + trendEndDay.toLocaleString('bn-BD') + ' তারিখের দৈনিক খরচ</p></div><button class="btn small" data-act="tab" data-tab="bazar">বাজার দেখুন <span aria-hidden="true">→</span></button></div>' +
      '<div class="dashboard-trend-metrics"><div><span>এই সময়ের মোট</span><strong>' + f2(trendTotal) + ' ৳</strong></div><div><span>দৈনিক গড়</span><strong>' + f2(trendTotal / trendDays.length) + ' ৳</strong></div></div>' +
      '<div class="dashboard-trend-chart" role="group" aria-label="তারিখ অনুযায়ী বাজার খরচের বার চার্ট">' +
      trendDays.map(function (item) {
        var barHeight = trendPeak ? Math.max(6, item.amount / trendPeak * 100) : 0;
        var accessibleValue = dayLabel(item.day) + ', ' + f2(item.amount) + ' টাকা';
        return '<div class="dashboard-trend-day" role="img" aria-label="' + esc(accessibleValue) + '" title="' + esc(accessibleValue) + '"><span class="dashboard-trend-track"><span class="dashboard-trend-bar" style="height:' + barHeight + '%"></span></span><span class="dashboard-trend-label">' + item.day.toLocaleString('bn-BD') + '</span></div>';
      }).join('') + '</div></section>';
    h += '<section class="panel daily-summary"><div class="daily-summary-head"><h2>দিনভিত্তিক হিসাব</h2><div class="field"><label for="summaryDay">তারিখ</label><select id="summaryDay" class="inp">' + dayOptions + '</select></div></div>';
    if (S.members.length) {
      h += '<div class="tablewrap"><table><thead><tr><th>সদস্য</th><th class="n">দুপুর</th><th class="n">রাত</th><th class="n">মোট মিল</th><th class="n">বাজার (৳)</th></tr></thead><tbody>';
      summaryRows.forEach(function (r) {
        var meals = dailyMeals[r.id] || { lunch: 0, dinner: 0 };
        h += '<tr><td class="name">' + esc(displayName(r.name)) + '</td><td class="n">' + fm(meals.lunch) + '</td><td class="n">' + fm(meals.dinner) + '</td><td class="n">' + fm(meals.lunch + meals.dinner) + '</td><td class="n">' + f2(dailyMarket[r.id] || 0) + '</td></tr>';
      });
      h += '</tbody><tfoot><tr><td>মোট</td><td class="n">' + fm(lunchTotal) + '</td><td class="n">' + fm(dinnerTotal) + '</td><td class="n">' + fm(lunchTotal + dinnerTotal) + '</td><td class="n">' + f2(dailyMarketTotal) + '</td></tr></tfoot></table></div>';
    } else {
      h += '<p class="hint">নির্বাচিত দিনের মিলের সারাংশ ও বাজারের দায়িত্ব উপরের দৈনিক পরিকল্পনায় দেখুন।</p>';
    }
    h += '</section>';
    h += monthlyReportContent(c);
    h += '<section class="panel"><div class="summary-panel-head"><div><h2>রিপোর্ট</h2><p class="hint">প্রকাশিত মাসিক রিপোর্ট দেখতে ও ডাউনলোড করতে রিপোর্ট বিভাগে যান।</p></div><button class="btn primary" data-act="tab" data-tab="reports">মাসিক রিপোর্ট দেখুন</button></div></section>';
    return h;
  }

  function monthlyReportContent(c) {
    var h = '<section class="panel"><div class="summary-panel-head"><h2>সদস্যভিত্তিক হিসাব (মাসিক রিপোর্ট)</h2>' +
      (S.fixedPublished ? '<span class="pill good">অনুমোদিত ও প্রকাশিত</span>' : '<span class="pill zero">মাসের শেষে প্রকাশিত হবে</span>') + '</div>';
    if (!S.fixedPublished) {
      h += '<div class="summary-pending-card" style="padding:22px;background:var(--tint);border:1px dashed var(--line);border-radius:16px;text-align:center;margin-top:6px">' +
        '<div style="font-size:32px;margin-bottom:8px">📊</div>' +
        '<h3 style="font-size:17px;margin:0 0 6px;color:var(--ink)">সদস্যভিত্তিক হিসাব এখনো প্রকাশিত হয়নি</h3>' +
        '<p class="hint" style="max-width:54ch;margin:0 auto">মাস শেষে অ্যাডমিন রিপোর্ট প্রকাশ করলে এখানে সদস্যভিত্তিক বিস্তারিত হিসাব দেখা যাবে।</p>' +
        (window.isAdmin ? '<div style="margin-top:14px"><button class="btn primary small" data-act="tab" data-tab="kharoch">নির্ধারিত খরচে যান ও প্রকাশ করুন →</button></div>' : '') +
        '</div>';
    } else if (!c.n) {
      h += '<p class="hint">এই মাসে কোনো সদস্যের হিসাব নেই।</p>';
    } else {
      if (c.totalMeal === 0 && c.totalBazar > 0) h += '<p class="warn">মিলের তথ্য নেই, তাই মিলের দর ০ দেখাচ্ছে।</p>';
      var summaryRows = c.rows.slice().sort(function (a, b) {
        return summaryMemberRank(a.name) - summaryMemberRank(b.name);
      });
      h += '<div class="tablewrap"><table><thead><tr><th>সদস্য</th><th class="n">বাসা ভাড়া</th><th class="n">মিল</th><th class="n">মিলের খরচ</th>' +
        S.fixed.map(function (x) { return '<th class="n">' + esc(fixedLabel(x.name)) + '</th>'; }).join('') +
        '<th class="n">মোট বিল</th><th class="n">বাজার করেছেন</th><th>অবস্থা</th></tr></thead><tbody>';
      summaryRows.forEach(function (r) {
        var member = S.members.filter(function (m) { return m.id === r.id; })[0];
        h += '<tr><td class="name">' + esc(displayName(r.name)) + '</td><td class="n">' + f2(r.rent) + '</td><td class="n">' + fm(r.meals) + '</td><td class="n">' + f2(r.mealCost) + '</td>' +
          S.fixed.map(function (x) { return '<td class="n">' + f2(fixedFor(x, member)) + '</td>'; }).join('') +
          '<td class="n">' + f2(r.bill) + '</td><td class="n">' + f2(r.spent) + '</td><td>' + pill(r.balance) + '</td></tr>';
      });
      h += '</tbody><tfoot><tr><td>মোট</td><td class="n">' + f2(c.rentTotal) + '</td><td class="n">' + fm(c.totalMeal) + '</td><td class="n">' + f2(c.totalBazar) + '</td>' +
        S.fixed.map(function (x) { return '<td class="n">' + f2(fixedAmount(x)) + '</td>'; }).join('') +
        '<td class="n">' + f2(c.rentTotal + c.totalBazar + c.fixedTotal) + '</td><td class="n">' + f2(c.totalBazar) + '</td><td></td></tr></tfoot></table></div>' +
        '<div class="chips"><span class="chip">মোট পাবেন <b>' + f2(c.pabe) + '</b></span><span class="chip">মোট দেবেন <b>' + f2(c.dibe) + '</b></span></div>' +
        '<p class="hint">বাসা ভাড়া + মিলের খরচ + নির্ধারিত খরচ = মোট বিল; বাজার ও জমা টাকা বিল থেকে বাদ। মিলের দর = মোট বাজার ÷ মোট মিল।</p>';
    }
    return h + '</section>';
  }

  async function loadPublishedReports() {
    reportsLoading = true;
    reportsError = '';
    renderView();
    try {
      var published = [];
      if (dbNS) {
        var snapshot = await dbNS.collection('months').get();
        snapshot.forEach(function (doc) {
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(doc.id)) return;
          var report = JSON.parse(doc.data().json);
          if (report && report.fixedPublished === true) published.push(doc.id);
        });
      } else {
        for (var storageIndex = 0; storageIndex < localStorage.length; storageIndex++) {
          var storageKey = localStorage.key(storageIndex);
          if (!storageKey || !/^mess:\d{4}-(0[1-9]|1[0-2])$/.test(storageKey)) continue;
          var localReport = JSON.parse(localStorage.getItem(storageKey));
          if (localReport && localReport.fixedPublished === true) published.push(storageKey.slice(5));
        }
      }
      reportMonths = Array.from(new Set(published)).sort().reverse();
      if (reportMonths.indexOf(selectedReportMonth) < 0) selectedReportMonth = '';
    } catch (err) {
      reportsError = 'প্রকাশিত মাসিক রিপোর্ট লোড হয়নি। Firebase সংযোগ ও months collection-এর read permission যাচাই করুন।';
      console.error('Published monthly reports could not be loaded:', err);
    } finally {
      reportsLoading = false;
      if (tab === 'reports') renderView();
    }
  }

  function viewReports() {
    var h = '<section class="panel"><div class="summary-panel-head"><div><h2>মাসিক রিপোর্ট</h2><p class="hint">অ্যাডমিন প্রকাশিত রিপোর্ট বেছে নিয়ে দেখুন অথবা PDF/Excel ডাউনলোড করুন।</p></div>' +
      '<button class="btn" data-act="refreshReports"' + (reportsLoading ? ' disabled' : '') + '>রিফ্রেশ</button></div>';
    if (reportsError) h += '<p class="warn">' + esc(reportsError) + '</p>';
    if (reportsLoading && !reportMonths.length) h += '<p class="hint">প্রকাশিত রিপোর্ট খোঁজা হচ্ছে…</p>';
    else if (!reportsLoading && !reportMonths.length && !reportsError) h += '<p class="hint">এখনো কোনো মাসিক রিপোর্ট প্রকাশিত হয়নি।</p>';
    if (reportMonths.length) {
      h += '<div class="report-month-list">';
      reportMonths.forEach(function (month) {
        h += '<button class="report-month-button' + (selectedReportMonth === month && ym === month ? ' is-selected' : '') +
          '" type="button" data-act="openReport" data-month="' + month + '" aria-pressed="' + String(selectedReportMonth === month && ym === month) + '">' +
          '<span class="report-month-icon" aria-hidden="true">▤</span><span><strong>' + esc(label(month)) + '</strong><small>প্রকাশিত সদস্যভিত্তিক রিপোর্ট</small></span>' +
          '<span class="report-month-arrow" aria-hidden="true">→</span></button>';
      });
      h += '</div></section>';
    } else h += '</section>';
    if (selectedReportMonth && ym === selectedReportMonth && S.fixedPublished && reportMonths.indexOf(ym) >= 0) {
      h += '<section class="panel"><div class="summary-panel-head"><div><h2>' + esc(label(ym)) + ' — মাসিক হিসাব</h2><p class="hint">এই রিপোর্ট অ্যাডমিন প্রকাশ করেছেন।</p></div></div>' +
        '<div class="row"><button class="btn primary" data-act="xlsx">Excel ডাউনলোড</button><button class="btn" data-act="pdf">PDF ডাউনলোড</button></div></section>' +
        monthlyReportContent(calc());
    } else if (selectedReportMonth) {
      h += '<section class="panel"><p class="hint">রিপোর্ট খুলতে উপরের মাসের নাম নির্বাচন করুন।</p></section>';
    } else if (reportMonths.length) {
      h += '<section class="panel"><p class="hint">বিস্তারিত দেখতে তালিকা থেকে একটি প্রকাশিত মাসিক রিপোর্ট নির্বাচন করুন।</p></section>';
    }
    return h;
  }

  function viewMeal() {
    var days = dim(ym), h = '<section class="panel"><h2>প্রতিদিনের মিল</h2><p class="hint">দায়িত্বপ্রাপ্ত সদস্য শুধু আজকের তারিখে মিল যোগ করতে পারবেন। একবার সেভ হলে সদস্য আর পরিবর্তন বা মুছতে পারবেন না; প্রয়োজন হলে অ্যাডমিন সংশোধন করবেন। অ্যাডমিন সব তারিখের মিল পরিচালনা করতে পারবেন। সব পরিবর্তন অডিটে সংরক্ষিত হবে।</p>';
    if (!S.members.length) return h + '<p class="hint">আগে সদস্য বিভাগে সদস্য যোগ করুন।</p></section>';
    var mealMembers = S.members.slice().sort(function (a, b) { return summaryMemberRank(a.name) - summaryMemberRank(b.name); });
    h += '<div class="tablewrap"><table class="grid" id="mealGrid"><thead><tr><th rowspan="2">দিন</th>';
    mealMembers.forEach(function (m) { h += '<th class="n" colspan="2">' + esc(displayName(m.name)) + '</th>'; });
    h += '<th class="n" rowspan="2">মিল</th></tr><tr>';
    mealMembers.forEach(function () { h += '<th><span class="meal-slot">দুপুর</span></th><th><span class="meal-slot">রাত</span></th>'; });
    h += '</tr></thead><tbody>';
    for (var d = 1; d <= days; d++) {
      var editable = canEditMealOnDay(d);
      var assignee = bazarAssignee(d);
      h += '<tr data-day="' + d + '" class="' + (editable ? 'turn-active-row' : 'turn-readonly-row') + (isCurrentDate(ym, d) ? ' today-menu-row' : '') + '"><td class="day">' + dayLabel(d) +
        (assignee ? ' <span style="font-size:11px;opacity:0.75;display:block">বাজার: ' + esc(displayName(assignee.name)) + '</span>' : '') + '</td>';
      mealMembers.forEach(function (m) {
        ['lunch', 'dinner'].forEach(function (slot, index) {
          var v = mealSlot(d, m.id, slot), labels = ['দুপুর', 'রাত'];
          var entryId = mealEntryDocId(ym, d, m.id, slot);
          var hasSavedMeal = Number(v) > 0 || Boolean(mealEntryDocs[entryId]);
          if (editable && (window.isAdmin || !hasSavedMeal)) {
            h += '<td class="n"><input class="inp num meal-input" type="number" inputmode="numeric" min="1" step="1" placeholder="–" data-f="meal" data-slot="' + slot + '" data-d="' + d + '" data-m="' + m.id + '" value="' + v + '" aria-label="' + esc(displayName(m.name)) + ', ' + d.toLocaleString('bn-BD') + ' তারিখ, ' + labels[index] + '"></td>';
          } else {
            h += '<td class="n' + (hasSavedMeal && !window.isAdmin ? ' meal-locked' : '') + '" style="color:var(--muted)">' + (v !== '' ? v : '<span style="opacity:0.4">–</span>') + (hasSavedMeal && !window.isAdmin ? '<span class="meal-lock-label">সেভ</span>' : '') + '</td>';
          }
        });
      });
      h += '<td class="n" data-live="dmeal" data-d="' + d + '"></td></tr>';
    }
    h += '</tbody><tfoot><tr><td>মোট মিল</td>';
    mealMembers.forEach(function (m) { h += '<td class="n" colspan="2" data-live="mmeal" data-m="' + m.id + '"></td>'; });
    h += '<td class="n" data-live="tmeal"></td></tr></tfoot></table></div></section>';
    return h;
  }

  function viewBazar() {
    var h = '<section class="panel"><h2>বাজারের পালার তালিকা</h2><p class="hint">মাসের দিন সদস্যদের মধ্যে সমানভাবে ভাগ হবে। ৩১ দিনের মাসে প্রথম পালা ৭ দিন এবং পরের পালাগুলো ৬ দিন করে। শুধু অ্যাডমিন পালার সদস্য ও অ্যাকাউন্ট নির্বাচন, সম্পাদনা বা মুছতে পারবেন।</p>';
    if (!S.members.length) return h + '<p class="hint">আগে সদস্য বিভাগে সদস্য যোগ করুন।</p></section>';
    var days = dim(ym), blockOptions = '', turnBlocks = marketTurnBlockCount(days);
    for (var block = 0; block < turnBlocks; block++) {
      var blockRange = marketTurnBlockRange(block, days), blockStart = blockRange.start, blockEnd = blockRange.end;
      blockOptions += '<option value="' + block + '">' + blockStart.toLocaleString('bn-BD') + '–' + blockEnd.toLocaleString('bn-BD') + ' তারিখ</option>';
    }
    var memberOptions = S.members.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(displayName(m.name)) + '</option>'; }).join('');
    var userOptions = '<option value="">অ্যাকাউন্ট নির্বাচন করুন</option>' + marketUsers.map(function (u) {
    return '<option value="' + esc(u.uid) + '">' + esc(displayName(u.name || u.email)) + (u.name && u.email ? ' (' + esc(u.email) + ')' : '') + '</option>';
    }).join('');
    if (window.isAdmin) {
      h += '<div class="row"><div class="field"><label for="marketTurnBlock">বাজারের পালা</label><select id="marketTurnBlock" class="inp">' + blockOptions + '</select></div>' +
        '<div class="field"><label for="marketTurnMember">বাজার করবেন</label><select id="marketTurnMember" class="inp">' + memberOptions + '</select></div>' +
        '<div class="field"><label for="marketTurnUser">সদস্যের লগইন অ্যাকাউন্ট</label><select id="marketTurnUser" class="inp">' + userOptions + '</select></div>' +
        '<button class="btn primary" data-act="saveMarketTurnBlock">পালা সেভ করুন</button></div>' +
        (marketUsers.length ? '' : '<p class="warn">অ্যাকাউন্টের তালিকা লোড হয়নি। Firestore Rules-এ অ্যাডমিনকে users পড়ার অনুমতি দিন, তারপর পেজ রিফ্রেশ করুন।</p>');
    }
    h += '<div class="tablewrap"><table><thead><tr><th>পালা</th><th>তারিখ</th><th>বাজার করবেন</th>' + (window.isAdmin ? '<th>লগইন অ্যাকাউন্ট</th><th>পরিচালনা</th>' : '') + '</tr></thead><tbody>';
    for (var turnBlock = 0; turnBlock < turnBlocks; turnBlock++) {
      var range = marketTurnBlockRange(turnBlock, days), turnStart = range.start, turnEnd = range.end;
      var turn = marketTurn(turnStart), assignedMember = bazarAssignee(turnStart), consistentTurn = true;
      for (var checkDay = turnStart + 1; checkDay <= turnEnd; checkDay++) {
        var dayTurn = marketTurn(checkDay);
        if (!turn || !dayTurn || dayTurn.mid !== turn.mid || dayTurn.uid !== turn.uid) { consistentTurn = false; break; }
      }
      if (!consistentTurn) { turn = null; assignedMember = null; }
      var assignedUser = turn && marketUsers.filter(function (u) { return u.uid === turn.uid; })[0];
      h += '<tr><td>' + (turnBlock + 1).toLocaleString('bn-BD') + '</td><td>' + turnStart.toLocaleString('bn-BD') + '–' + turnEnd.toLocaleString('bn-BD') + '</td><td class="name">' + esc(assignedMember ? displayName(assignedMember.name) : (consistentTurn ? 'নির্ধারিত নয়' : 'পালা আপডেট প্রয়োজন')) + '</td>';
      if (window.isAdmin) {
        h += '<td>' + esc(assignedUser ? displayName(assignedUser.name || assignedUser.email) : (turn && turn.uid ? 'অ্যাকাউন্ট তালিকায় নেই' : 'অ্যাকাউন্ট যুক্ত নয়')) + '</td><td><button class="btn small" data-act="editMarketTurnBlock" data-block="' + turnBlock + '">সম্পাদনা</button> ' +
          '<button class="btn small danger" data-act="delMarketTurnBlock" data-block="' + turnBlock + '">মুছুন</button></td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table></div></section>';
    var entriesByDay = {};
    S.bazar.forEach(function (entry) {
      if (!entriesByDay[entry.day]) entriesByDay[entry.day] = [];
      entriesByDay[entry.day].push(entry);
    });
    h += '<section class="panel market-daily-panel"><div><h2>তারিখ অনুযায়ী বাজার ও স্ট্যাটাস</h2><p class="hint">সবাই দেখতে পারবেন কোন দিনে কার বাজারের দায়িত্ব, কে বাজার করেছেন এবং বাজারের অবস্থা।</p></div>' +
      '<div class="tablewrap"><table class="market-daily-table"><thead><tr><th>তারিখ</th><th>দায়িত্বে</th><th>বাজার করেছেন / কী কিনেছেন</th><th class="n">মোট টাকা</th><th>স্ট্যাটাস</th></tr></thead><tbody>';
    var currentDate = new Date(), currentMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0');
    for (var scheduleDay = 1; scheduleDay <= days; scheduleDay++) {
      var dayEntries = entriesByDay[scheduleDay] || [], dayAssignee = bazarAssignee(scheduleDay);
      var dayStatus = marketDayStatus(scheduleDay, dayEntries.length > 0);
      var dayTotal = dayEntries.reduce(function (total, entry) { return total + entry.amount; }, 0);
      var buyersAndItems = dayEntries.length ? dayEntries.slice().sort(function (a, b) {
        return marketMemberRank(a.mid) - marketMemberRank(b.mid);
      }).map(function (entry) {
        return '<span class="market-entry-detail"><strong>' + esc(memberName(entry.mid)) + '</strong> — ' + esc(entry.note || 'বিবরণ নেই') + '</span>';
      }).join('') : '<span class="hint">এখনো বাজারের তথ্য নেই</span>';
      var isToday = ym === currentMonth && scheduleDay === currentDate.getDate();
      h += '<tr' + (isToday ? ' class="market-today-row"' : '') + '><td class="market-date">' + dayLabel(scheduleDay) + (isToday ? '<span class="market-today-tag">আজ</span>' : '') + '</td>' +
        '<td class="name">' + esc(dayAssignee ? displayName(dayAssignee.name) : 'নির্ধারিত নয়') + '</td><td class="market-buyers">' + buyersAndItems + '</td>' +
        '<td class="n">' + (dayEntries.length ? f2(dayTotal) + ' ৳' : '—') + '</td><td><span class="pill ' + dayStatus.style + '">' + dayStatus.label + '</span></td></tr>';
    }
    h += '</tbody></table></div></section>';
    h += '<section class="panel"><h2>বাজারের খরচ</h2>';
    if (S.members.length === 5) {
      var today = new Date().getDate(), isCurrentMonth = ym === currentMonthKey();
      var eligibleDays = [], expenseDayOptions = '';
      for (var expenseDay = 1; expenseDay <= days; expenseDay++) {
        if (!window.isAdmin && (!isCurrentMonth || expenseDay !== today)) continue;
        if (!canManageBazarDay(expenseDay)) continue;
        eligibleDays.push(expenseDay);
        var expenseMember = bazarAssignee(expenseDay);
        expenseDayOptions += '<option value="' + expenseDay + '">' + dayLabel(expenseDay) + ' — ' + esc(expenseMember ? displayName(expenseMember.name) : 'নির্ধারিত নয়') + '</option>';
      }
      var selectedDay = eligibleDays.indexOf(today) >= 0 ? today : eligibleDays[0];
      if (eligibleDays.length) {
        expenseDayOptions = expenseDayOptions.replace('value="' + selectedDay + '"', 'value="' + selectedDay + '" selected');
        h += '<p class="hint">' + (window.isAdmin ? 'অ্যাডমিন সব দিনের বাজারের খরচ যোগ করতে পারবেন।' : 'আপনার পালার দিনে শুধু আজকের তারিখের বাজার যোগ করতে পারবেন।') + '</p><div class="row"><div class="field"><label for="bzDay">তারিখ ও দায়িত্বপ্রাপ্ত সদস্য</label><select id="bzDay" class="inp">' + expenseDayOptions + '</select></div>' +
        '<div class="field"><label for="bzAmt">টাকার পরিমাণ *</label><input id="bzAmt" class="inp num" type="number" inputmode="decimal" min="0.01" step="any" placeholder="০" style="width:130px" required></div>' +
        '<div class="field" style="flex:1 1 180px"><label for="bzNote">কী কিনেছেন</label><input id="bzNote" class="inp" type="text" maxlength="60" placeholder="চাল, সবজি, তেল..."></div>' +
        '<button class="btn primary" data-act="addBazar">যোগ করুন</button></div>';
        var existingMenu = S.dailyMenus[String(selectedDay)];
        if (!window.isAdmin && existingMenu) {
          h += '<div class="daily-menu-entry"><div class="field"><label>আজকের মেনু</label><p class="hint">' + esc(existingMenu.text) + '</p></div><p class="hint">মেনু দেওয়া হয়েছে। পরিবর্তন বা মুছতে অ্যাডমিনের সঙ্গে যোগাযোগ করুন।</p></div>';
        } else {
          h += '<div class="daily-menu-entry"><div class="field"><label for="bzMenu">আজকের মেনু</label><textarea id="bzMenu" class="inp" maxlength="500" rows="2" placeholder="যেমন: ভাত, ডাল, ডিম ভাজি">' + esc(existingMenu && existingMenu.text || '') + '</textarea></div>' +
            '<div class="daily-menu-actions"><button class="btn primary" type="button" data-act="saveDailyMenu">মেনু সেভ করুন</button>' +
            (window.isAdmin && existingMenu ? '<button class="btn danger" type="button" data-act="deleteDailyMenu" data-day="' + selectedDay + '">মেনু মুছুন</button>' : '') + '</div></div>';
        }
      } else h += '<p class="hint">' + (window.isAdmin ? 'বাজারের পালা নির্ধারণ করতে সদস্য যোগ করুন।' : isCurrentMonth ? 'আজকের তারিখে আপনার পালা নেই। পালা বদলাতে অ্যাডমিনের সঙ্গে যোগাযোগ করুন।' : 'বাজারের entry শুধু চলতি মাসের আজকের তারিখে করা যাবে।') + '</p>';
    } else h += '<p class="hint">বাজারের খরচ যোগ করতে সদস্য তালিকায় ৫ জন সদস্য থাকতে হবে।</p>';
    h += '</section>';
    var c = calc();
    h += '<section class="panel"><h2>বাজারের তালিকা</h2>';
    h += '<div class="chips">' + c.rows.slice().sort(function (a, b) { return marketMemberRank(a.id) - marketMemberRank(b.id); })
      .map(function (r) { return '<span class="chip">' + esc(displayName(r.name)) + ' <b>' + f2(r.spent) + '</b></span>'; }).join('') + '</div>';
    if (!S.bazar.length) { h += '<p class="hint">এখনো কোনো বাজারের তথ্য যোগ করা হয়নি।</p>'; }
    else {
      var hasBazarActions = window.isAdmin;
      var list = S.bazar.slice().sort(compareBazarEntries);
      h += '<div class="tablewrap"><table><thead><tr><th>তারিখ</th><th>সদস্য</th><th>কেনাকাটা</th><th class="n">টাকা</th>' + (hasBazarActions ? '<th></th>' : '') + '</tr></thead><tbody>';
      list.forEach(function (b) {
        if (canManageBazarEntry(b) && editingBazarId === b.id) {
          h += '<tr><td>' + dayLabel(b.day) + '</td><td class="name">' + esc(memberName(b.mid)) + '</td>' +
            '<td><input class="inp" id="bzEditNote-' + b.id + '" type="text" maxlength="60" value="' + esc(b.note || '') + '" aria-label="কেনাকাটার বিবরণ"></td>' +
            '<td class="n"><input class="inp num" id="bzEditAmount-' + b.id + '" type="number" min="0.01" step="any" value="' + b.amount + '" aria-label="টাকার পরিমাণ"></td>' +
            '<td><button class="btn small primary" data-act="saveBazarEdit" data-id="' + b.id + '">সেভ</button> <button class="btn small" data-act="cancelBazarEdit">বাতিল</button></td></tr>';
        } else {
          h += '<tr><td>' + dayLabel(b.day) + '</td><td class="name">' + esc(memberName(b.mid)) + '</td><td>' + esc(b.note || '') + '</td><td class="n">' + f2(b.amount) + '</td>' +
            (canManageBazarEntry(b) ? '<td><button class="btn small" data-act="editBazar" data-id="' + b.id + '">সম্পাদনা</button> <button class="btn small danger" data-act="delBazar" data-id="' + b.id + '">মুছুন</button></td>' : (hasBazarActions ? '<td></td>' : '')) + '</tr>';
        }
      });
      h += '</tbody><tfoot><tr><td colspan="3">মোট বাজার</td><td class="n">' + f2(c.totalBazar) + '</td>' + (hasBazarActions ? '<td></td>' : '') + '</tr></tfoot></table></div>';
    }
    return h + '</section>';
  }

  function viewAdmin() {
    if (!window.isAdmin) return '<section class="panel"><h2>অনুমতি নেই</h2><p class="hint">এই পেজটি শুধু অ্যাডমিন দেখতে পারবেন।</p></section>';
    var h = '<section class="panel admin-audit-panel"><div class="summary-panel-head"><div><h2>অডিট লগ</h2><p class="hint">মিল ও বাজারের পরিবর্তন কে করেছেন—তারিখসহ অডিট ইতিহাস এখানে দেখুন।</p></div>' +
      '<button class="btn" data-act="refreshAudit" ' + (auditLoading ? 'disabled' : '') + '>' + (auditLoading ? 'লোড হচ্ছে…' : 'রিফ্রেশ') + '</button></div>';
    if (auditError) h += '<p class="warn">' + esc(auditError) + '</p>';
    else if (auditLoading && !auditLogs.length) h += '<p class="hint">অডিট লগ লোড হচ্ছে…</p>';
    else if (!auditLogs.length) h += '<p class="hint">এখনো কোনো পরিবর্তনের লগ নেই। মিল বা বাজার যোগ/সম্পাদনা/মুছলে লগ তৈরি হবে।</p>';
    else {
      h += '<p class="hint">সর্বশেষ ' + auditLogs.length.toLocaleString('bn-BD') + 'টি পরিবর্তন</p><div class="tablewrap"><table><thead><tr><th>সময়</th><th>কাজ</th><th>কে করেছেন</th><th>মাস/তারিখ</th><th>সদস্য</th><th>বিবরণ</th><th class="n">টাকা / মিল</th></tr></thead><tbody>';
      auditLogs.forEach(function (log) {
        var actionName = log.action === 'bazar_add' ? 'বাজার যোগ' :
          log.action === 'bazar_edit' ? 'বাজার সম্পাদনা' :
            log.action === 'bazar_delete' ? 'বাজার মুছুন' :
              log.action === 'meal_add' ? 'মিল যোগ' :
                log.action === 'meal_edit' ? 'মিল সম্পাদনা' :
                  log.action === 'meal_delete' ? 'মিল মুছুন' : 'পুরোনো তথ্য স্থানান্তর';
        var isMealLog = log.action.indexOf('meal_') === 0;
        var mealSlotLabel = log.note === 'lunch' ? 'দুপুর' : log.note === 'dinner' ? 'রাত' : log.note;
        var description = isMealLog
          ? (mealSlotLabel || 'মিল') + (log.action === 'meal_edit'
            ? ': ' + fm(Number(log.before && log.before.value) || 0) + ' → ' + fm(Number(log.after && log.after.value) || 0) + ' মিল'
            : log.action === 'meal_delete'
              ? ' — ' + fm(Number(log.before && log.before.value) || 0) + ' মিল মুছেছেন'
              : ' — ' + fm(Number(log.after && log.after.value) || 0) + ' মিল যোগ করেছেন')
          : log.action === 'bazar_add'
          ? (log.after && log.after.note || 'বাজারের খরচ যোগ করেছেন') + ' (' + f2(Number(log.after && log.after.amount) || 0) + ' ৳)'
          : log.action === 'bazar_edit'
            ? (log.before && log.before.note || '—') + ' (' + f2(Number(log.before && log.before.amount) || 0) + ' ৳) → ' +
              (log.after && log.after.note || '—') + ' (' + f2(Number(log.after && log.after.amount) || 0) + ' ৳)'
            : log.action === 'bazar_delete'
              ? (log.before && log.before.note || 'মুছে ফেলা বাজারের তথ্য') + ' (' + f2(Number(log.before && log.before.amount) || 0) + ' ৳)'
              : 'আগের বাজারের এন্ট্রি ডেটাবেজে স্থানান্তর';
        var amount = isMealLog
          ? (log.action === 'meal_delete' ? log.before && log.before.value : log.after && log.after.value)
          : (log.action === 'bazar_edit' && log.after ? log.after.amount : log.amount);
        h += '<tr><td>' + esc(auditDate(log.createdAt)) + '</td><td><span class="pill ' + (log.action === 'bazar_delete' || log.action === 'meal_delete' ? 'bad' : 'good') + '">' + actionName + '</span></td>' +
          '<td><strong>' + esc(displayName(log.actorName || 'অজানা')) + '</strong><br><small>' + esc(log.actorEmail || '') + '</small></td>' +
          '<td>' + esc(log.month || '') + '<br>' + (Number(log.day) || 0).toLocaleString('bn-BD') + ' তারিখ</td>' +
          '<td>' + esc(displayName(log.member || '')) + '</td><td>' + esc(description) + '</td><td class="n">' + (isMealLog ? fm(Number(amount) || 0) + ' মিল' : f2(Number(amount) || 0) + ' ৳') + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    return h + '</section>';
  }

  async function loadAuditLogs() {
    if (!window.isAdmin || !dbNS) {
      auditError = 'অডিট লগ দেখতে Firebase সংযোগ ও অ্যাডমিন অনুমতি প্রয়োজন।';
      auditLogs = [];
      renderView();
      return;
    }
    auditLoading = true;
    auditError = '';
    renderView();
    try {
      var snapshot = await dbNS.collection('auditLogs').orderBy('createdAt', 'desc').limit(100).get();
      auditLogs = snapshot.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); });
    } catch (err) {
      auditError = 'অডিট লগ লোড হয়নি। Firestore Rules প্রকাশিত আছে কি না যাচাই করুন।';
      console.error('Audit log load failed:', err);
    } finally {
      auditLoading = false;
      if (tab === 'admin') renderView();
    }
  }

  function viewKharoch() {
    var h = '<section class="panel"><h2>নির্ধারিত খরচ</h2><p class="hint">বাসা ভাড়া সদস্য বিভাগে প্রত্যেকের নামে লিখুন। “অন্যান্য খরচ” দরকার হলে পরিমাণ লিখুন, না হলে ০ রাখুন। “সমান ভাগ” হলে সবাই সমান দেবেন, “আলাদা পরিমাণ” হলে প্রত্যেকের জন্য আলাদা টাকা লিখুন।</p>';
    if (!S.members.length) h += '<p class="warn">আলাদা পরিমাণ দিতে হলে আগে সদস্য বিভাগে সদস্য যোগ করুন।</p>';
    h += '<div class="tablewrap"><table><thead><tr><th>খরচের নাম</th><th>ভাগের নিয়ম</th><th class="n">টাকা</th><th></th></tr></thead><tbody>';
    S.fixed.forEach(function (x) {
      var cust = x.split === 'custom';
      h += '<tr><td>' + (x.locked || !window.isAdmin ? '<span class="name">' + esc(x.name) + '</span>' : '<input class="inp" type="text" maxlength="40" data-f="fname" data-id="' + x.id + '" value="' + esc(x.name) + '" aria-label="খরচের নাম">') + '</td>' +
        '<td><select class="inp" data-f="fsplit" data-id="' + x.id + '" aria-label="ভাগের নিয়ম"' + (window.isAdmin ? '' : ' disabled') + '><option value="equal"' + (cust ? '' : ' selected') + '>সমান ভাগ</option><option value="custom"' + (cust ? ' selected' : '') + '>আলাদা পরিমাণ</option></select></td>';
      if (cust) h += '<td class="n" data-live="fitem" data-id="' + x.id + '"></td>';
      else h += '<td class="n">' + (window.isAdmin ? '<input class="inp num" type="number" inputmode="decimal" min="0" step="any" data-f="famt" data-id="' + x.id + '" value="' + (x.amount || '') + '" placeholder="০" style="width:120px" aria-label="টাকা">' : '<span>' + (x.amount || '') + '</span>') + '</td>';
      h += '<td>' + (x.locked || !window.isAdmin ? '' : '<button class="btn small danger" data-act="delFixed" data-id="' + x.id + '">মুছুন</button>') + '</td></tr>';
      if (cust && S.members.length) {
        h += '<tr><td colspan="4" style="background:var(--bg)"><div class="row">';
        S.members.forEach(function (m) {
          var v = (x.custom && x.custom[m.id]) || '';
          h += '<div class="field"><label for="fc-' + x.id + m.id + '">' + esc(displayName(m.name)) + '</label>' + (window.isAdmin ? '<input id="fc-' + x.id + m.id + '" class="inp num" type="number" inputmode="decimal" min="0" step="any" data-f="fcust" data-id="' + x.id + '" data-m="' + m.id + '" value="' + v + '" placeholder="০" style="width:100px">' : '<span>' + v + '</span>') + '</div>';
        });
        h += '</div></td></tr>';
      }
    });
    h += '</tbody><tfoot><tr><td colspan="2">মোট নির্ধারিত খরচ</td><td class="n" id="fxTotal"></td><td></td></tr></tfoot></table></div>';
    h += '<h3 style="font-size:15px">সদস্যপ্রতি নির্ধারিত খরচ</h3><div class="chips">' + S.members.map(function (m) { return '<span class="chip">' + esc(displayName(m.name)) + ' <b data-live="mfix" data-m="' + m.id + '"></b></span>'; }).join('') + '</div>';
    if (window.isAdmin) {
      h += '<div class="row"><div class="field" style="flex:1 1 180px"><label for="nfName">নতুন খরচ</label><input id="nfName" class="inp" type="text" maxlength="40" placeholder="যেমন: মেরামত খরচ"></div>' +
        '<div class="field"><label for="nfSplit">ভাগের নিয়ম</label><select id="nfSplit" class="inp"><option value="equal">সমান ভাগ</option><option value="custom">আলাদা পরিমাণ</option></select></div>' +
        '<div class="field"><label for="nfAmt">টাকা (সমান ভাগ হলে)</label><input id="nfAmt" class="inp num" type="number" inputmode="decimal" min="0" step="any" placeholder="০" style="width:110px"></div>' +
        '<button class="btn primary" data-act="addFixed">যোগ করুন</button></div>';
      var publishButtons = '';
      if (S.fixedPublished) {
        publishButtons = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<button class="btn primary" data-act="publishFixedReport" title="আপডেট ও সেভ করুন" style="min-height:42px">✓ আপডেট ও সেভ</button>' +
          '<button class="btn" data-act="editFixedReport" title="সম্পাদনা করুন" style="min-height:42px">✏️ সম্পাদনা</button>' +
          '<button class="btn danger" data-act="deleteFixedReport" title="রিপোর্ট মুছুন / অপ্রকাশিত করুন" style="min-height:42px">🗑️ মুছুন (বাতিল)</button>' +
          '</div>';
      } else {
        publishButtons = '<button class="btn primary" data-act="publishFixedReport" style="min-height:44px;font-size:15px">নির্ধারিত খরচ সেভ ও ড্যাশবোর্ডে প্রকাশ করুন</button>';
      }
      h += '<div class="admin-publish-box" style="margin-top:20px;padding:18px 20px;background:var(--tint);border:1px solid var(--line);border-radius:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px">' +
        '<div style="flex:1 1 300px"><h4 style="margin:0 0 4px;font-size:16px;color:var(--ink)">মাসিক নির্ধারিত খরচ প্রকাশ ও ড্যাশবোর্ড আপডেট</h4><p style="margin:0;font-size:13.5px;color:var(--muted)">মাসের শেষে নির্ধারিত খরচ চূড়ান্ত করে সেভ করলে তা মাসিক রিপোর্ট আকারে সংরক্ষিত হবে এবং ড্যাশবোর্ডে সকল সদস্যের জন্য প্রকাশিত হবে। ' + (S.fixedPublished ? '<span class="pill good" style="margin-left:6px">প্রকাশিত</span>' : '<span class="pill zero" style="margin-left:6px">অপ্রকাশিত</span>') + '</p></div>' +
        publishButtons + '</div>';
    }
    return h + '</section>';
  }

  function viewMember() {
    var h = '<section class="panel"><h2>সদস্য</h2><p class="hint">' + (window.isAdmin
      ? 'সদস্য যোগ, সম্পাদনা, ক্রম পরিবর্তন ও মুছুন শুধু অ্যাডমিন পারবেন। সর্বোচ্চ ৫ জন সদস্য রাখা যাবে।'
      : 'সদস্যদের তালিকা দেখতে পারবেন; যোগ, সম্পাদনা ও মুছুন শুধু অ্যাডমিন করতে পারবেন।') + '</p>';
    if (!S.members.length) h += '<p class="hint">এখনো কোনো সদস্য যোগ করা হয়নি।</p>';
    else {
      h += '<div class="tablewrap"><table><thead><tr><th class="n">ক্রম</th><th>নাম</th><th class="n">বাসা ভাড়া (৳)</th><th>পালার ক্রম</th><th></th></tr></thead><tbody>';
      S.members.forEach(function (m, index) {
        h += '<tr><td class="n">' + (index + 1).toLocaleString('bn-BD') + '</td><td>' + (window.isAdmin ? '<input class="inp" type="text" maxlength="30" data-f="mname" data-id="' + m.id + '" value="' + esc(displayName(m.name)) + '" aria-label="সদস্যের নাম">' : '<span class="name">' + esc(displayName(m.name)) + '</span>') + '</td>' +
          '<td class="n">' + (window.isAdmin ? '<input class="inp num" type="number" inputmode="decimal" min="0" step="any" data-f="mrent" data-id="' + m.id + '" value="' + (m.rent || '') + '" placeholder="০" style="width:120px" aria-label="বাসা ভাড়া">' : f2(m.rent || 0)) + '</td>' +
          (window.isAdmin ? '<td><button class="btn small" data-act="moveMember" data-dir="-1" data-id="' + m.id + '" aria-label="' + esc(displayName(m.name)) + ' উপরে নিন"' + (index === 0 ? ' disabled' : '') + '>↑</button> <button class="btn small" data-act="moveMember" data-dir="1" data-id="' + m.id + '" aria-label="' + esc(displayName(m.name)) + ' নিচে নিন"' + (index === S.members.length - 1 ? ' disabled' : '') + '>↓</button></td><td><button class="btn small danger" data-act="delMember" data-id="' + m.id + '">মুছুন</button></td>' : '<td colspan="2"></td>') + '</tr>';
      });
      h += '</tbody></table></div>';
    }
    if (window.isAdmin && S.members.length < 5) h += '<div class="row"><div class="field" style="flex:1 1 200px"><label for="nmName">নতুন সদস্যের নাম</label><input id="nmName" class="inp" type="text" maxlength="30" placeholder="নাম লিখুন"></div><button class="btn primary" data-act="addMember">সদস্য যোগ করুন</button></div>';
    else if (S.members.length >= 5) h += '<p class="hint">সর্বোচ্চ ৫ জন সদস্য যোগ করা হয়েছে।</p>';
    else h += '<p class="hint">সদস্য যোগ করতে অ্যাডমিনের সঙ্গে যোগাযোগ করুন।</p>';
    return h + '</section>';
  }

  function viewDashboard() {
    return viewHishab();
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
    var v = tab === 'hishab' ? viewHishab() : tab === 'reports' ? viewReports() : tab === 'meal' ? viewMeal() : tab === 'bazar' ? viewBazar() : tab === 'kharoch' ? viewKharoch() : tab === 'admin' ? viewAdmin() : viewMember();
    $('view').innerHTML = v; refreshLive();
  }
  function renderAll() {
    $('monthLabel').textContent = label(ym);
    $('messName').value = S.name || '';
    $('messName').readOnly = !window.isAdmin;
    $('adminTab').hidden = !window.isAdmin;
    $('tabs').classList.toggle('has-admin', window.isAdmin);
    if (!window.isAdmin && tab === 'admin') tab = 'hishab';
    if (currentProfile) {
      $('headerUserName').textContent = displayName(currentProfile.name || 'আমার প্রোফাইল');
      $('userAvatar').textContent = displayName(currentProfile.name || 'ম').trim().charAt(0).toLocaleUpperCase('bn-BD');
    }
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
  $('messName').addEventListener('input', function (e) {
    if (!window.isAdmin) { e.target.value = S.name || ''; return; }
    S.name = e.target.value; commit();
  });

  $('view').addEventListener('input', function (e) {
    var t = e.target, f = t.dataset.f; if (!f) return;
    if (f === 'meal') {
      var d = t.dataset.d;
      var existingMeal = num(mealSlot(d, t.dataset.m, t.dataset.slot));
      if (!canEditMealOnDay(Number(d))) {
        toast('শুধু আজকের তারিখে দায়িত্বপ্রাপ্ত সদস্য মিল যোগ করতে পারবেন');
        renderView();
        return;
      }
      if (!window.isAdmin && (existingMeal > 0 || mealEntryDocs[mealEntryDocId(ym, d, t.dataset.m, t.dataset.slot)])) {
        toast('এই মিলটি আগে সেভ হয়েছে; পরিবর্তনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন');
        renderView();
        return;
      }
      var v = num(t.value);
      if (!S.meals[d]) S.meals[d] = {};
      var meal = S.meals[d][t.dataset.m];
      if (typeof meal !== 'object' || !meal) meal = { breakfast: 0, lunch: 0, dinner: 0 };
      meal[t.dataset.slot] = v;
      if (mealCount(meal) > 0) S.meals[d][t.dataset.m] = meal; else delete S.meals[d][t.dataset.m];
      queueMealChange(ym, d, t.dataset.m, t.dataset.slot, v, existingMeal);
    } else if (f === 'mname') {
      if (!window.isAdmin) { toast('সদস্যের তথ্য শুধু অ্যাডমিন সম্পাদনা করতে পারবেন'); renderView(); return; }
      S.members.forEach(function (m) { if (m.id === t.dataset.id) m.name = t.value; });
    } else if (f === 'mrent') {
      if (!window.isAdmin) { toast('সদস্যের তথ্য শুধু অ্যাডমিন সম্পাদনা করতে পারবেন'); renderView(); return; }
      S.members.forEach(function (m) { if (m.id === t.dataset.id) m.rent = num(t.value); });
    } else if (f === 'mjoma') {
      if (!window.isAdmin) { toast('সদস্যের তথ্য শুধু অ্যাডমিন সম্পাদনা করতে পারবেন'); renderView(); return; }
      S.members.forEach(function (m) { if (m.id === t.dataset.id) m.joma = num(t.value); });
    } else if (f === 'fname') {
      if (!window.isAdmin) return;
      S.fixed.forEach(function (x) { if (x.id === t.dataset.id) x.name = t.value; });
    } else if (f === 'famt') {
      if (!window.isAdmin) return;
      S.fixed.forEach(function (x) { if (x.id === t.dataset.id) x.amount = num(t.value); });
    } else if (f === 'fcust') {
      if (!window.isAdmin) return;
      S.fixed.forEach(function (x) { if (x.id === t.dataset.id) { if (!x.custom) x.custom = {}; x.custom[t.dataset.m] = num(t.value); } });
    } else if (f === 'fsplit') {
      if (!window.isAdmin) return;
      S.fixed.forEach(function (x) { if (x.id === t.dataset.id) x.split = t.value === 'custom' ? 'custom' : 'equal'; });
      commit(); renderView(); return;
    }
    refreshLive(); commit();
  });

  document.addEventListener('click', async function (e) {
    if (e.target === $('confirmOverlay')) {
      var dismissedButton = pendingDeleteButton;
      closeDeleteConfirmation();
      if (dismissedButton && dismissedButton.isConnected) dismissedButton.focus();
      return;
    }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    var adminActions = ['addMember', 'delMember', 'moveMember', 'addFixed', 'delFixed', 'publishFixedReport', 'editFixedReport', 'deleteFixedReport', 'toggleMemberSummary', 'restore', 'saveMarketTurnBlock', 'editMarketTurnBlock', 'delMarketTurnBlock', 'refreshAudit'];
    if (!window.isAdmin && adminActions.indexOf(a) >= 0) { toast('এই কাজটি শুধু অ্যাডমিন করতে পারবেন'); return; }
    if (a === 'cancelDelete') {
      var cancelledButton = pendingDeleteButton;
      closeDeleteConfirmation();
      if (cancelledButton && cancelledButton.isConnected) cancelledButton.focus();
      return;
    }
    if (a === 'confirmDelete') {
      var targetButton = pendingDeleteButton;
      closeDeleteConfirmation();
      if (targetButton && targetButton.isConnected) {
        confirmedDeleteButton = targetButton;
        targetButton.click();
      }
      return;
    }
    if (['delMember', 'delBazar', 'delFixed', 'delMarketTurnBlock', 'deleteDailyMenu', 'deleteFixedReport'].indexOf(a) >= 0 && confirmedDeleteButton !== b) {
      openDeleteConfirmation(b);
      return;
    }
    if (confirmedDeleteButton === b) confirmedDeleteButton = null;
    if (a === 'auth-show-register') { setAuthMode('register'); return; }
    if (a === 'auth-show-login') { setAuthMode('login'); return; }
    if (a === 'auth-signin' || a === 'auth-register') {
      var email = $('authEmail').value.trim(), password = $('authPassword').value;
      var message = $('authMessage');
      message.textContent = '';
      if (!email || !password) { message.textContent = 'ইমেইল ও পাসওয়ার্ড লিখুন।'; return; }
      var registration = null;
      if (a === 'auth-register') {
        registration = { name: $('authName').value.trim(), mobile: $('authMobile').value.trim() };
        if (!registration.name || !registration.mobile) { message.textContent = 'নতুন account-এর জন্য নাম ও মোবাইল নম্বর লিখুন।'; return; }
        if (password.length < 6) { message.textContent = 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।'; return; }
      }
      if (!authNS) { message.textContent = 'Firebase Auth চালু হয়নি। পেজটি আবার লোড করুন।'; return; }
      b.disabled = true;
      try {
        if (a === 'auth-register') {
          creatingAccount = true;
          var credential = await authNS.createUserWithEmailAndPassword(email, password);
          var newProfile = { name: registration.name, email: credential.user.email, mobile: registration.mobile, address: '', updatedAt: Date.now() };
          await dbNS.collection('users').doc(credential.user.uid).set(newProfile);
          await authNS.signOut();
          creatingAccount = false;
          $('authLayout').hidden = false; $('profilePanel').hidden = true; $('appShell').hidden = true;
          setAuthMode('login');
          $('authEmail').value = email; $('authPassword').value = '';
          message.textContent = 'Account তৈরি হয়েছে। এখন email ও password দিয়ে লগইন করুন।';
          message.classList.add('is-success');
        } else await authNS.signInWithEmailAndPassword(email, password);
      } catch (err) {
        creatingAccount = false;
        if (authNS.currentUser && a === 'auth-register') {
          showProfileForm(authNS.currentUser, registration, true);
          $('profileMessage').textContent = 'অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু profile সেভ হয়নি। Firestore Rules যাচাই করে আবার চেষ্টা করুন।';
          return;
        }
        var authErrors = {
          'auth/email-already-in-use': 'এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।',
          'auth/invalid-email': 'ইমেইল ঠিকানাটি সঠিক নয়।',
          'auth/weak-password': 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।',
          'auth/user-not-found': 'এই ইমেইলে অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট তৈরি করুন।',
          'auth/wrong-password': 'পাসওয়ার্ডটি সঠিক নয়।',
          'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।',
          'auth/operation-not-allowed': 'Firebase Console-এ Email/Password sign-in চালু করুন।'
        };
        message.textContent = authErrors[err.code] || err.message || 'লগইন করা যায়নি।';
      } finally { creatingAccount = false; b.disabled = false; }
      return;
    }
    if (a === 'profile-open') { showProfileForm(currentUser, currentProfile, false); return; }
    if (a === 'profile-cancel') { $('profilePanel').hidden = true; $('appShell').hidden = false; return; }
    if (a === 'profile-save') {
      var pName = $('profileName').value.trim(), pMobile = $('profileMobile').value.trim(), pAddress = $('profileAddress').value.trim();
      var pMessage = $('profileMessage'); pMessage.textContent = '';
      if (!pName || !pMobile) { pMessage.textContent = 'নাম ও মোবাইল নম্বর পূরণ করুন।'; return; }
      b.disabled = true;
      try {
        if (profileSetup) {
          currentProfile = { name: pName, email: currentUser.email, mobile: pMobile, address: pAddress, updatedAt: Date.now() };
          await dbNS.collection('users').doc(currentUser.uid).set(currentProfile);
          await enterApp(currentUser, currentProfile);
        } else {
          await dbNS.collection('users').doc(currentUser.uid).update({ name: pName, mobile: pMobile, address: pAddress, updatedAt: Date.now() });
          currentProfile.name = pName; currentProfile.mobile = pMobile; currentProfile.address = pAddress;
          $('headerUserName').textContent = pName || 'আমার প্রোফাইল';
          $('userAvatar').textContent = pName.trim().charAt(0).toLocaleUpperCase('bn-BD') || 'ম';
          $('profilePanel').hidden = true; $('appShell').hidden = false;
          toast('প্রোফাইল সেভ হয়েছে');
        }
      } catch (err) { pMessage.textContent = 'Profile সেভ হয়নি। Firestore Rules যাচাই করুন।'; console.error('Profile save failed:', err); }
      finally { b.disabled = false; }
      return;
    }
    if (a === 'auth-signout') {
      if (!await doSave()) return;
      if (authNS) await authNS.signOut();
      return;
    }
    if (a === 'theme') {
      var isDark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var nextTheme = isDark ? 'light' : 'dark';
      document.documentElement.dataset.theme = nextTheme;
      try { localStorage.setItem('mess-theme', nextTheme); } catch (err) {}
      toast(nextTheme === 'dark' ? 'ডার্ক মোড চালু হয়েছে' : 'লাইট মোড চালু হয়েছে');
      return;
    }
    if (a === 'saveDailyMenu') {
      var menuDay = $('bzDay') ? Number($('bzDay').value) : 0;
      var menuText = $('bzMenu') ? $('bzMenu').value.trim() : '';
      if (!currentUser || !dbNS) { toast('মেনু সেভ করতে Firebase-এ লগইন থাকতে হবে'); return; }
      if (!Number.isInteger(menuDay) || menuDay < 1 || menuDay > dim(ym) || !canManageBazarDay(menuDay) || (!window.isAdmin && !isCurrentDate(ym, menuDay))) {
        toast('শুধু এই দিনের বাজারের দায়িত্বপ্রাপ্ত সদস্য মেনু দিতে পারবেন'); return;
      }
      if (!window.isAdmin && S.dailyMenus[String(menuDay)]) {
        toast('মেনু আগে দেওয়া হয়েছে; পরিবর্তনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন'); return;
      }
      if (!menuText) { toast('আজকের মেনু লিখুন'); return; }
      try {
        await dbNS.collection('dailyMenus').doc(ym + '_' + menuDay).set({
          month: ym,
          day: String(menuDay),
          menu: menuText,
          uid: currentUser.uid,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        S.dailyMenus[String(menuDay)] = { text: menuText, uid: currentUser.uid };
        try { localStorage.setItem('mess:' + ym, JSON.stringify(S)); } catch (storageErr) { console.error('Local daily menu cache update failed:', storageErr); }
        toast('আজকের মেনু ড্যাশবোর্ডে প্রকাশ হয়েছে');
        renderView();
      } catch (menuErr) {
        console.error('Daily menu save failed:', menuErr);
        toast('মেনু সেভ হয়নি। Firestore Rules প্রকাশিত আছে কি না যাচাই করুন।');
      }
      return;
    }
    if (a === 'deleteDailyMenu') {
      var deleteMenuDay = Number(b.dataset.day);
      if (!window.isAdmin) { toast('মেনু শুধু অ্যাডমিন মুছতে পারবেন'); return; }
      if (!currentUser || !dbNS) { toast('মেনু মুছতে Firebase-এ লগইন থাকতে হবে'); return; }
      if (!Number.isInteger(deleteMenuDay) || deleteMenuDay < 1 || deleteMenuDay > dim(ym) || !canManageBazarDay(deleteMenuDay) || (!window.isAdmin && !isCurrentDate(ym, deleteMenuDay))) {
        toast('শুধু এই দিনের বাজারের দায়িত্বপ্রাপ্ত সদস্য মেনু মুছতে পারবেন'); return;
      }
      try {
        await dbNS.collection('dailyMenus').doc(ym + '_' + deleteMenuDay).delete();
        delete S.dailyMenus[String(deleteMenuDay)];
        try { localStorage.setItem('mess:' + ym, JSON.stringify(S)); } catch (storageErr) { console.error('Local daily menu cache update failed:', storageErr); }
        toast('মেনু মুছে ফেলা হয়েছে');
        renderView();
      } catch (menuDeleteErr) {
        console.error('Daily menu delete failed:', menuDeleteErr);
        toast('মেনু মুছতে পারেনি। Firestore Rules প্রকাশিত আছে কি না যাচাই করুন।');
      }
      return;
    }
    if (a === 'backup') { await exportBackup(); return; }
    if (a === 'restore') { $('restoreFile').click(); return; }
    if (a === 'tab') {
      if (b.dataset.tab === 'admin' && !window.isAdmin) { toast('অ্যাডমিন প্যানেল শুধু অ্যাডমিন দেখতে পারবেন'); return; }
      tab = b.dataset.tab; renderAll();
      if (tab === 'admin') await loadAuditLogs();
      if (tab === 'reports') await loadPublishedReports();
      return;
    }
    if (a === 'refreshReports') { await loadPublishedReports(); return; }
    if (a === 'openReport') {
      var requestedReportMonth = b.dataset.month;
      if (reportMonths.indexOf(requestedReportMonth) < 0 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedReportMonth)) {
        toast('এই মাসের প্রকাশিত রিপোর্ট পাওয়া যায়নি। রিপোর্ট তালিকা রিফ্রেশ করুন।');
        return;
      }
      if (!await doSave()) { toast('বর্তমান মাসের তথ্য সেভ হয়নি; রিপোর্ট খোলা যায়নি।'); return; }
      if (ym !== requestedReportMonth) await loadMonth(requestedReportMonth);
      if (!S.fixedPublished) {
        selectedReportMonth = '';
        await loadPublishedReports();
        toast('এই মাসের রিপোর্ট আর প্রকাশিত নেই।');
        return;
      }
      selectedReportMonth = requestedReportMonth;
      renderAll();
      return;
    }
    if (a === 'refreshAudit') { await loadAuditLogs(); return; }
    if (a === 'toggleMemberSummary') { S.showMemberSummary = S.showMemberSummary !== true; commit(); renderView(); return; }
    if (a === 'prev' || a === 'next') {
      if (!await doSave()) return;
      await loadMonth(shift(ym, a === 'next' ? 1 : -1));
      dashboardDay = null;
      selectedReportMonth = '';
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
      if (S.members.length !== 5 || !member || !canManageBazarDay(marketDay) || (!window.isAdmin && !isCurrentDate(ym, marketDay))) {
        toast('বাজারের দায়িত্বপ্রাপ্ত সদস্য শুধু আজকের তারিখে বাজার যোগ করতে পারবেন'); return;
      }
      if (!amt) { toast('টাকার পরিমাণ লিখুন'); return; }
      var newBazar = {
        id: uid(), day: marketDay, mid: member.id, amount: amt, note: $('bzNote').value.trim(),
        uid: currentUser.uid, auditId: uid() + uid(), nextAuditId: uid() + uid()
      };
      try {
        await persistBazarChange('bazar_add', null, newBazar);
        toast('বাজার যোগ হয়েছে এবং অডিট লগে সংরক্ষিত হয়েছে');
      } catch (auditErr) {
        console.error('Bazar save and audit log failed:', auditErr);
        toast('বাজার সেভ হয়নি। Firebase সংযোগ ও Rules যাচাই করুন।');
      }
      var keepDay = $('bzDay').value; renderView(); $('bzDay').value = keepDay; $('bzAmt').focus(); return;
    }
    if (a === 'editBazar') {
      var editableEntry = S.bazar.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (!canManageBazarEntry(editableEntry)) { toast('বাজারের তথ্য শুধু অ্যাডমিন সম্পাদনা করতে পারবেন'); return; }
      editingBazarId = b.dataset.id; renderView(); return;
    }
    if (a === 'cancelBazarEdit') { editingBazarId = ''; renderView(); return; }
    if (a === 'saveBazarEdit') {
      var bazarEntry = S.bazar.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (!canManageBazarEntry(bazarEntry)) { toast('বাজারের তথ্য শুধু অ্যাডমিন সম্পাদনা করতে পারবেন'); return; }
      var changedAmount = num($('bzEditAmount-' + bazarEntry.id).value);
      if (!changedAmount) { toast('টাকার পরিমাণ লিখুন'); return; }
      var beforeBazar = Object.assign({}, bazarEntry);
      var afterBazar = Object.assign({}, bazarEntry, {
        amount: changedAmount,
        note: $('bzEditNote-' + bazarEntry.id).value.trim()
      });
      try {
        await persistBazarChange('bazar_edit', beforeBazar, afterBazar);
        toast('বাজারের পরিবর্তন অডিট লগে সংরক্ষিত হয়েছে');
      } catch (auditErr) {
        console.error('Bazar edit and audit log failed:', auditErr);
        toast('বাজারের পরিবর্তন সেভ হয়নি। Firebase সংযোগ ও Rules যাচাই করুন।');
      }
      editingBazarId = ''; renderView(); return;
    }
    if (a === 'saveMarketTurnBlock') {
      var selectedBlock = Number($('marketTurnBlock').value), turnMember = $('marketTurnMember').value, turnUid = $('marketTurnUser').value;
      var monthDays = dim(ym), blockCount = marketTurnBlockCount(monthDays), selectedRange = marketTurnBlockRange(selectedBlock, monthDays);
      if (!selectedRange || selectedBlock >= blockCount || !S.members.some(function (m) { return m.id === turnMember; })) {
        toast('বাজারের পালা ও সদস্য নির্বাচন করুন'); return;
      }
      if (!turnUid || !marketUsers.some(function (u) { return u.uid === turnUid; })) {
        toast('এই পালার জন্য সদস্যের লগইন অ্যাকাউন্ট নির্বাচন করুন'); return;
      }
      if (!S.marketTurns) S.marketTurns = {};
      for (var day = selectedRange.start; day <= selectedRange.end; day++) {
        S.marketTurns[String(day)] = { mid: turnMember, uid: turnUid };
      }
      mealEntriesNeedSync = true;
      commit();
      var turnSaved = await doSave();
      renderView();
      if (turnSaved) toast(selectedRange.start.toLocaleString('bn-BD') + '–' + selectedRange.end.toLocaleString('bn-BD') + ' তারিখের পালা সেভ হয়েছে');
      return;
    }
    if (a === 'editMarketTurnBlock') {
      var editBlock = Number(b.dataset.block), editRange = marketTurnBlockRange(editBlock, dim(ym));
      if (!editRange) return;
      var editTurn = marketTurn(editRange.start);
      $('marketTurnBlock').value = String(editBlock);
      $('marketTurnMember').value = editTurn && editTurn.mid || '';
      $('marketTurnUser').value = editTurn && editTurn.uid || '';
      $('marketTurnBlock').focus(); return;
    }
    if (a === 'delMarketTurnBlock') {
      if (!S.marketTurns) return;
      var deleteBlock = Number(b.dataset.block), deleteRange = marketTurnBlockRange(deleteBlock, dim(ym));
      if (!deleteRange) return;
      for (var deleteDay = deleteRange.start; deleteDay <= deleteRange.end; deleteDay++) {
        delete S.marketTurns[String(deleteDay)];
      }
      mealEntriesNeedSync = true;
      commit();
      var turnDeleted = await doSave();
      renderView();
      if (turnDeleted) toast('পালাটি মুছে স্বয়ংক্রিয় সদস্যভাগ ফিরিয়ে আনা হয়েছে');
      return;
    }
    if (a === 'delBazar') {
      var entry = S.bazar.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (!canManageBazarEntry(entry)) { toast('বাজারের তথ্য শুধু অ্যাডমিন মুছতে পারবেন'); return; }
      var deletedBazar = Object.assign({}, entry);
      try {
        await persistBazarChange('bazar_delete', deletedBazar, null);
        toast('বাজার মুছে ফেলা হয়েছে এবং অডিট লগে সংরক্ষিত হয়েছে');
      } catch (auditErr) {
        console.error('Bazar delete and audit log failed:', auditErr);
        toast('বাজার মুছে ফেলা সেভ হয়নি। Firebase সংযোগ ও Rules যাচাই করুন।');
      }
      editingBazarId = ''; renderView(); return;
    }
    if (a === 'addFixed') {
      if (!window.isAdmin) { toast('শুধুমাত্র অ্যাডমিন খরচ যোগ করতে পারবেন'); return; }
      var fn = $('nfName').value.trim(); if (!fn) { toast('খরচের নাম লিখুন'); return; }
      S.fixed.push({ id: uid(), name: fn, amount: num($('nfAmt').value), split: $('nfSplit').value === 'custom' ? 'custom' : 'equal', custom: {} }); commit(); renderView(); $('nfName').focus(); return;
    }
    if (a === 'delFixed') {
      if (!window.isAdmin) { toast('শুধুমাত্র অ্যাডমিন খরচ মুছতে পারবেন'); return; }
      if (S.fixed.some(function (x) { return x.id === b.dataset.id && x.locked; })) return;
      S.fixed = S.fixed.filter(function (x) { return x.id !== b.dataset.id; }); commit(); renderView(); return;
    }
    if (a === 'publishFixedReport') {
      if (!window.isAdmin) { toast('শুধুমাত্র অ্যাডমিন রিপোর্ট প্রকাশ করতে পারবেন'); return; }
      S.fixedPublished = true;
      S.fixedPublishedAt = Date.now();
      if (!await doSave()) return;
      renderView();
      toast('নির্ধারিত খরচ সেভ হয়েছে এবং সদস্যভিত্তিক হিসাব ড্যাশবোর্ডে প্রকাশিত হয়েছে');
      return;
    }
    if (a === 'editFixedReport') {
      if (!window.isAdmin) { toast('শুধুমাত্র অ্যাডমিন সম্পাদনা করতে পারবেন'); return; }
      toast('এখন আপনি উপরের নির্ধারিত খরচ সম্পাদনা করতে পারবেন। সম্পাদনা শেষে ‘আপডেট ও সেভ’ বাটনে চাপুন।');
      var firstInp = document.querySelector('[data-f="famt"], [data-f="fcust"]');
      if (firstInp) firstInp.focus();
      return;
    }
    if (a === 'deleteFixedReport') {
      if (!window.isAdmin) { toast('শুধুমাত্র অ্যাডমিন রিপোর্ট মুছতে পারবেন'); return; }
      S.fixedPublished = false;
      delete S.fixedPublishedAt;
      if (!await doSave()) return;
      renderView();
      toast('মাসিক রিপোর্ট বাতিল করা হয়েছে এবং ড্যাশবোর্ড থেকে সরানো হয়েছে');
      return;
    }
    if (a === 'xlsx') {
      if (tab !== 'reports' || !S.fixedPublished || selectedReportMonth !== ym) { toast('প্রকাশিত রিপোর্ট নির্বাচন করে ডাউনলোড করুন'); return; }
      await exportXlsx(); return;
    }
    if (a === 'pdf') {
      if (tab !== 'reports' || !S.fixedPublished || selectedReportMonth !== ym) { toast('প্রকাশিত রিপোর্ট নির্বাচন করে ডাউনলোড করুন'); return; }
      await exportPdf(); return;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (!pendingDeleteButton) return;
    if (e.key === 'Tab') {
      var actions = $('confirmOverlay').querySelectorAll('button:not([disabled])');
      var firstAction = actions[0], lastAction = actions[actions.length - 1];
      if (e.shiftKey && document.activeElement === firstAction) {
        e.preventDefault();
        lastAction.focus();
      } else if (!e.shiftKey && document.activeElement === lastAction) {
        e.preventDefault();
        firstAction.focus();
      }
      return;
    }
    if (e.key !== 'Escape') return;
    var cancelledButton = pendingDeleteButton;
    closeDeleteConfirmation();
    if (cancelledButton && cancelledButton.isConnected) cancelledButton.focus();
  });

  $('view').addEventListener('change', async function (e) {
    if (e.target.id === 'summaryDay') { dashboardDay = Number(e.target.value); renderView(); return; }
    if (e.target.id === 'bzDay') {
      var assigned = bazarAssignee(Number(e.target.value));
      if ($('bzAssignee')) $('bzAssignee').innerHTML = 'এই তারিখে বাজারের দায়িত্ব: <b>' + esc(assigned ? assigned.name : '?') + '</b>';
      if ($('bzMenu')) $('bzMenu').value = S.dailyMenus[String(e.target.value)] && S.dailyMenus[String(e.target.value)].text || '';
      return;
    }
    if (e.target.id !== 'restoreFile' || !e.target.files || !e.target.files[0]) return;
    if (!window.isAdmin) { toast('ব্যাকআপ ফিরিয়ে আনতে শুধু অ্যাডমিন পারবেন'); e.target.value = ''; return; }
    var file = e.target.files[0];
    try {
      var pack = JSON.parse(await file.text());
      if (!pack || pack.app !== 'mess-hishab' || !pack.months || typeof pack.months !== 'object') throw new Error('format');
      var keys = Object.keys(pack.months);
      if (!keys.length || keys.some(function (k) { var st = pack.months[k]; return !/^\d{4}-\d{2}$/.test(k) || !st || !Array.isArray(st.members) || !Array.isArray(st.bazar) || !st.meals || !Array.isArray(st.fixed); })) throw new Error('data');
      if (!window.confirm(keys.length.toLocaleString('bn-BD') + ' মাসের তথ্য ফিরিয়ে আনা হবে। একই মাসের পুরোনো তথ্য বদলে যেতে পারে। চালিয়ে যাবেন?')) return;
      for (var ri = 0; ri < keys.length; ri++) {
        var rk = keys[ri], restoredState = pack.months[rk];
        restoredState.marketTurns = restoredState.marketTurns || {};
        var rjson = JSON.stringify(restoredState);
        localStorage.setItem('mess:' + rk, rjson);
        if (dbNS) {
          await dbNS.doc('months/' + rk).set({ json: rjson, updated: Date.now() });
          await dbNS.doc('marketTurns/' + rk).set({ assignments: restoredState.marketTurns, updated: Date.now() });
          await syncMealEntries(rk, restoredState);
        }
      }
      await loadMonth(ym); renderAll(); setStatus('ব্যাকআপ ফিরিয়ে আনা হয়েছে'); toast('ব্যাকআপ ফিরিয়ে আনা হয়েছে');
    } catch (err) { toast('ব্যাকআপ ফাইলটি সঠিক নয় বা সেভ করা যায়নি।'); }
    e.target.value = '';
  });

  /* ---------- export ---------- */
  function loadExternalScript(src) {
    if (externalScriptLoads[src]) return externalScriptLoads[src];
    externalScriptLoads[src] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = function () {
        delete externalScriptLoads[src];
        script.remove();
        reject(new Error('রিপোর্ট লাইব্রেরি ডাউনলোড করা যায়নি: ' + src));
      };
      document.head.appendChild(script);
    });
    return externalScriptLoads[src];
  }
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
    if (!await doSave()) return;
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
  async function exportXlsx() {
    try {
      if (!window.XLSX) await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      if (!window.XLSX) throw new Error('XLSX library did not initialize');
    } catch (err) {
      console.error('Excel export library failed to load:', err);
      toast('এক্সেল রিপোর্ট লোড হয়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
      return;
    }
    var c = calc(), t = label(ym), wb = XLSX.utils.book_new();
    var sum = [[S.name + ' - মাসিক হিসাব - ' + t], [], ['মোট বাজার (৳)', r2(c.totalBazar)], ['মোট মিল', r2(c.totalMeal)], ['মিলের দর (৳)', r2(c.rate)], ['মোট বাসা ভাড়া (৳)', r2(c.rentTotal)], ['অন্যান্য নির্ধারিত খরচ (৳)', r2(c.fixedTotal)], ['সদস্য সংখ্যা', c.n], ['নির্ধারিত খরচ জনপ্রতি (৳)', r2(c.share)], [],
      ['সদস্য', 'বাসা ভাড়া', 'মিল', 'মিলের খরচ', 'অন্যান্য নির্ধারিত', 'মোট বিল', 'বাজার করেছেন', 'জমা', 'দেবেন (+) / পাবেন (-)']];
    c.rows.forEach(function (r) { sum.push([displayName(r.name), r2(r.rent), r2(r.meals), r2(r.mealCost), r2(r.share), r2(r.bill), r2(r.spent), r2(r.joma), r2(-r.balance)]); });
    sum.push(['মোট', r2(c.rentTotal), r2(c.totalMeal), r2(c.totalBazar), r2(c.fixedTotal), r2(c.rentTotal + c.totalBazar + c.fixedTotal), r2(c.totalBazar), r2(S.members.reduce(function (a, m) { return a + m.joma; }, 0)), '']);
    var w1 = XLSX.utils.aoa_to_sheet(sum); w1['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, w1, 'হিসাব');
    var mh = ['দিন'].concat(S.members.map(function (m) { return displayName(m.name); }), ['মিল', 'বাজার']);
    var w2 = XLSX.utils.aoa_to_sheet([mh].concat(mealRows(c))); w2['!cols'] = [{ wch: 14 }];
    XLSX.utils.book_append_sheet(wb, w2, 'মিল');
    var bz = [['তারিখ', 'সদস্য', 'কেনাকাটা', 'টাকা']];
    S.bazar.slice().sort(compareBazarEntries).forEach(function (b) { bz.push([dayLabel(b.day), memberName(b.mid), b.note || '', r2(b.amount)]); });
    bz.push(['মোট', '', '', r2(c.totalBazar)]);
    var w3 = XLSX.utils.aoa_to_sheet(bz); w3['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, w3, 'বাজার');
    var fx = [['খরচ', 'মোট'].concat(S.members.map(function (m) { return displayName(m.name); }))];
    S.fixed.forEach(function (x) { fx.push([x.name, r2(fixedAmount(x))].concat(S.members.map(function (m) { return r2(fixedFor(x, m)); }))); });
    fx.push(['মোট', r2(c.fixedTotal)].concat(c.rows.map(function (r) { return r2(r.share); })));
    var w4 = XLSX.utils.aoa_to_sheet(fx); w4['!cols'] = [{ wch: 24 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, w4, 'নির্ধারিত খরচ');
    await saveFile('mess-hishab-' + ym + '.xlsx', XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  }
  async function exportPdf() {
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF did not initialize');
      if (!window.html2canvas) await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      if (!window.html2canvas) throw new Error('html2canvas did not initialize');
    } catch (err) {
      console.error('PDF export libraries failed to load:', err);
      toast('পিডিএফ রিপোর্ট লোড হয়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
      return;
    }
    var c = calc(), t = label(ym);
    var pdfPages = [];
    function addPdfSection(title, headers, rows, rightColumns, summary) {
      var pageSize = 22;
      var chunks = [];
      for (var offset = 0; offset < rows.length; offset += pageSize) chunks.push(rows.slice(offset, offset + pageSize));
      if (!chunks.length) chunks.push([]);
      chunks.forEach(function (chunk, index) {
        pdfPages.push({ title: title, headers: headers, rows: chunk, rightColumns: rightColumns || [], summary: index === 0 ? summary || '' : '' });
      });
    }
    var memberRows = c.rows.map(function (r) {
      return [displayName(r.name), f2(r.rent), fm(r.meals), f2(r.mealCost), f2(r.share), f2(r.bill), f2(r.spent), f2(r.joma), (r.balance >= 0 ? 'পাবেন ' : 'দেবেন ') + f2(Math.abs(r.balance))];
    });
    memberRows.push(['মোট', f2(c.rentTotal), fm(c.totalMeal), f2(c.totalBazar), f2(c.fixedTotal), f2(c.rentTotal + c.totalBazar + c.fixedTotal), f2(c.totalBazar), f2(S.members.reduce(function (a, m) { return a + m.joma; }, 0)), '']);
    var summary = '<div style="display:flex;gap:8px;margin-bottom:14px">' +
      '<div style="flex:1;padding:8px;background:#eef0ff;border-radius:6px"><b>মোট বাজার</b><br>' + esc(f2(c.totalBazar) + ' ৳') + '</div>' +
      '<div style="flex:1;padding:8px;background:#eef0ff;border-radius:6px"><b>মোট মিল</b><br>' + esc(fm(c.totalMeal)) + '</div>' +
      '<div style="flex:1;padding:8px;background:#eef0ff;border-radius:6px"><b>মিলের দর</b><br>' + esc(f2(c.rate) + ' ৳') + '</div>' +
      '<div style="flex:1;padding:8px;background:#eef0ff;border-radius:6px"><b>বাসা ভাড়া</b><br>' + esc(f2(c.rentTotal) + ' ৳') + '</div>' +
      '<div style="flex:1;padding:8px;background:#eef0ff;border-radius:6px"><b>অন্যান্য খরচ</b><br>' + esc(f2(c.fixedTotal) + ' ৳') + '</div></div>';
    addPdfSection('মাসিক হিসাব', ['সদস্য', 'বাসা ভাড়া', 'মিল', 'মিলের খরচ', 'অন্যান্য খরচ', 'মোট বিল', 'বাজার করেছেন', 'জমা', 'অবস্থা'], memberRows, [1, 2, 3, 4, 5, 6, 7], summary);

    var fixedRows = S.fixed.map(function (x) {
      return [x.name, f2(fixedAmount(x))].concat(S.members.map(function (m) { return f2(fixedFor(x, m)); }));
    });
    fixedRows.push(['মোট', f2(c.fixedTotal)].concat(c.rows.map(function (r) { return f2(r.share); })));
    addPdfSection('নির্ধারিত খরচ', ['নির্ধারিত খরচ', 'মোট'].concat(S.members.map(function (m) { return displayName(m.name); })), fixedRows,
      S.members.map(function (_m, index) { return index + 1; }).concat([S.members.length + 1]));

    if (S.bazar.length) {
      var bb = S.bazar.slice().sort(compareBazarEntries).map(function (b) { return [dayLabel(b.day), memberName(b.mid), b.note || '', f2(b.amount)]; });
      bb.push(['মোট', '', '', f2(c.totalBazar)]);
      addPdfSection('বাজারের তালিকা', ['তারিখ', 'সদস্য', 'কেনাকাটা', 'টাকা'], bb, [3]);
    }
    if (S.members.length) {
      var mr = mealRows(c);
      var tot = ['মোট'].concat(c.rows.map(function (r) { return fm(r.meals); }), [fm(c.totalMeal), f2(c.totalBazar)]);
      mr.push(tot);
      addPdfSection('প্রতিদিনের মিল', ['দিন'].concat(S.members.map(function (m) { return displayName(m.name); }), ['মিল', 'বাজার']), mr,
        S.members.map(function (_m, index) { return index + 1; }).concat([S.members.length + 1, S.members.length + 2]));
    }
    var report = document.createElement('div');
    report.setAttribute('aria-hidden', 'true');
    report.style.cssText = 'position:fixed;left:-12000px;top:0;z-index:-1;pointer-events:none;';
    document.body.appendChild(report);
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'l', compress: true });
    var pageWidth = 1123, pageHeight = 794, padding = 38;
    try {
      for (var pageIndex = 0; pageIndex < pdfPages.length; pageIndex++) {
        var page = pdfPages[pageIndex];
        var tableHead = '<thead><tr>' + page.headers.map(function (cell) {
          return '<th style="background:#3a3fcb;color:#fff;border:1px solid #2930a6;padding:6px 5px;text-align:left;overflow-wrap:anywhere">' + esc(cell) + '</th>';
        }).join('') + '</tr></thead>';
        var tableBody = '<tbody>' + page.rows.map(function (row) {
          var isTotal = row[0] === 'মোট';
          return '<tr' + (isTotal ? ' class="total"' : '') + '>' + row.map(function (cell, cellIndex) {
            var align = page.rightColumns.indexOf(cellIndex) >= 0 ? 'text-align:right;' : '';
            var weight = isTotal ? 'font-weight:700;background:#eef0ff;' : '';
            return '<td style="border:1px solid #d8deef;padding:5px;vertical-align:top;overflow-wrap:anywhere;' + align + weight + '">' + esc(cell == null ? '' : cell) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody>';
        report.innerHTML = '<div class="pdf-report-page" style="width:' + pageWidth + 'px;height:' + pageHeight + 'px;padding:' + padding + 'px;box-sizing:border-box;background:#fff;color:#171a3b;font-family:var(--font-body);overflow:hidden;display:flex;flex-direction:column">' +
          '<div style="border-bottom:2px solid #3a3fcb;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:end">' +
          '<div><h1 style="font-size:22px;line-height:1.2;margin:0;color:#252a8f">' + esc(S.name || 'মেস') + ' — ' + esc(page.title) + '</h1><div style="font-size:13px;color:#5e6685;margin-top:4px">' + esc(t) + '</div></div>' +
          '<div style="font-size:11px;color:#5e6685">' + (pageIndex + 1).toLocaleString('bn-BD') + ' / ' + pdfPages.length.toLocaleString('bn-BD') + '</div></div>' +
          (page.summary || '') +
          '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;line-height:1.25"><colgroup>' + page.headers.map(function () { return '<col>'; }).join('') + '</colgroup>' +
          tableHead + tableBody + '</table>' +
          '<div style="margin-top:auto;padding-top:8px;border-top:1px solid #d8deef;font-size:9px;color:#7a819b">মেস হিসাব · ' + esc(t) + '</div>' +
          '</div>';
        var reportPage = report.firstElementChild;
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        var canvas = await window.html2canvas(reportPage, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: false });
        if (pageIndex) doc.addPage('a4', 'landscape');
        doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), undefined, 'FAST');
        canvas.width = 0;
        canvas.height = 0;
      }
    } catch (renderErr) {
      console.error('Bengali PDF rendering failed:', renderErr);
      toast('পিডিএফ তৈরি করা যায়নি। ফন্ট/ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
      return;
    } finally {
      report.remove();
    }
    await saveFile('mess-hishab-' + ym + '.pdf', doc.output('arraybuffer'));
  }

  /* ---------- boot ---------- */
  async function boot() {
    try { var savedTheme = localStorage.getItem('mess-theme'); if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme; } catch (e) {}
    try {
      if (!window.firebase || !window.firebase.apps.length) throw new Error('Firebase SDK not loaded');
      authNS = window.firebase.auth();
      dbNS = window.firebase.firestore();
      authNS.onAuthStateChanged(handleAuthState);
    } catch (e) {
      $('authLayout').hidden = false;
      setAuthMode('login');
      $('authMessage').textContent = 'Firebase চালু হয়নি। ইন্টারনেট ও Firebase config যাচাই করুন।';
      console.error('Firebase initialization failed:', e);
    }
  }
  boot();
})();
