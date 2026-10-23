/* HRM 노무관리파트 — 통합 포털
 * 구조: 로그인(Supabase Auth + editors 등록 확인) → 홈(카테고리 카드) → 각 카테고리 화면
 * 라우팅: location.hash  (#/ , #/<카테고리id> , #/<카테고리id>/<탭id> , #/settings)
 * 새 카테고리·탭은 아래 CATEGORIES 배열에 항목을 추가하면 홈·상단 메뉴·라우팅에 자동 반영된다.
 */
(function(){
  "use strict";

  var TITLE = "HRM 노무관리파트";

  var ICONS = {
    inspection: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z"/><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M8.5 13l2.5 2.5L16 10.5"/></svg>',
    leave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9.5 14.5l1.8 1.8 3.4-3.4"/></svg>',
    attendance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5"/></svg>'
  };

  // 카테고리 레지스트리 — 세부 기능은 각 카테고리의 tabs에 하나씩 추가해 나간다.
  var CATEGORIES = [
    {
      id: "inspection",
      name: "근로감독 관리대장",
      desc: "근로감독 이력·적발 사항·재적발 위험을 누적 관리합니다.",
      color: "var(--cat-insp)", bg: "var(--cat-insp-bg)",
      legacyUrl: "https://h9239021-ops.github.io/labor-compliance-ledger/",
      tabs: [ { id: "overview", name: "개요" } ]
    },
    {
      id: "leave",
      name: "연차 관리대장",
      desc: "연차 발생·사용·정산 현황을 관리합니다.",
      color: "var(--cat-leave)", bg: "var(--cat-leave-bg)",
      legacyUrl: "https://h9239021-ops.github.io/leave-calculator/",
      tabs: [ { id: "overview", name: "개요" } ]
    },
    {
      id: "attendance",
      name: "근태 관리대장",
      desc: "출퇴근·근로시간 기록을 점검하고 관리합니다.",
      color: "var(--cat-att)", bg: "var(--cat-att-bg)",
      legacyUrl: "https://h9239021-ops.github.io/geunte-attendance/",
      tabs: [ { id: "overview", name: "개요" } ]
    }
  ];

  /* ---------- utils ---------- */
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function findCat(id){
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return null;
  }
  function toast(msg){
    var t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 2400);
  }
  function todayLabel(){
    var d = new Date();
    var w = ["일","월","화","수","목","금","토"][d.getDay()];
    return d.getFullYear() + "년 " + (d.getMonth()+1) + "월 " + d.getDate() + "일 (" + w + ")";
  }

  /* ---------- supabase ---------- */
  var sb = (window.SUPABASE_CONFIG && window.supabase)
    ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey)
    : null;
  var currentUser = null;   // { id, email, name }
  // 초대/복구 링크의 토큰은 클라이언트 생성 직후 처리되므로 리스너를 즉시 붙인다.
  var pendingPasswordRecovery = false;
  if (sb){
    sb.auth.onAuthStateChange(function(event){
      if (event === "PASSWORD_RECOVERY") pendingPasswordRecovery = true;
      if (event === "SIGNED_OUT" && currentUser){ currentUser = null; renderLoginScreen(); }
    });
  }

  /* ---------- auth screens ---------- */
  function brandHtml(){
    return '<div class="auth-brand"><div class="brand-mark">HR</div><div class="brand-name">' + esc(TITLE) + '<small>노무관리 통합 페이지</small></div></div>';
  }
  function renderCenteredScreen(innerHtml){
    document.getElementById("app").innerHTML =
      '<div class="auth-screen"><div class="auth-card">' + innerHtml + '</div></div>';
  }
  function renderLoadingScreen(msg){
    renderCenteredScreen(brandHtml() + '<p class="hint">' + esc(msg || "불러오는 중...") + '</p>');
  }
  function renderLoginScreen(errorMsg){
    renderCenteredScreen(
      brandHtml() +
      '<p class="hint" style="margin-bottom:16px;">등록된 계정으로 로그인하세요.</p>' +
      (errorMsg ? '<p class="hint" style="color:var(--danger-700);margin-bottom:10px;">' + esc(errorMsg) + '</p>' : '') +
      '<form id="loginForm" class="f">' +
        '<input type="email" id="loginEmail" placeholder="이메일" autocomplete="username" required>' +
        '<input type="password" id="loginPw" placeholder="비밀번호" autocomplete="current-password" required>' +
        '<div class="form-actions"><button type="submit" class="btn primary" id="loginSubmitBtn">로그인</button></div>' +
      '</form>' +
      '<p class="hint" style="margin-top:12px;font-size:12px;">계정이 없거나 비밀번호를 잊으셨다면 관리자에게 문의하세요.</p>'
    );
    document.getElementById("loginForm").addEventListener("submit", async function(e){
      e.preventDefault();
      var email = document.getElementById("loginEmail").value.trim();
      var pw = document.getElementById("loginPw").value;
      document.getElementById("loginSubmitBtn").disabled = true;
      var res = await sb.auth.signInWithPassword({ email: email, password: pw });
      if (res.error){ renderLoginScreen("로그인에 실패했습니다: " + res.error.message); return; }
      await afterLogin(res.data.user);
    });
  }
  function renderSetPasswordScreen(){
    renderCenteredScreen(
      brandHtml() +
      '<p class="hint" style="margin-bottom:16px;">앞으로 사용할 비밀번호를 설정해주세요.</p>' +
      '<form id="setPwForm" class="f">' +
        '<input type="password" id="setPw1" placeholder="새 비밀번호 (6자 이상)" required minlength="6" autocomplete="new-password">' +
        '<input type="password" id="setPw2" placeholder="새 비밀번호 확인" required minlength="6" autocomplete="new-password">' +
        '<div class="form-actions"><button type="submit" class="btn primary">비밀번호 설정</button></div>' +
      '</form>'
    );
    document.getElementById("setPwForm").addEventListener("submit", async function(e){
      e.preventDefault();
      var p1 = document.getElementById("setPw1").value;
      var p2 = document.getElementById("setPw2").value;
      if (p1.length < 6){ alert("비밀번호는 6자 이상이어야 합니다."); return; }
      if (p1 !== p2){ alert("비밀번호 확인이 일치하지 않습니다."); return; }
      var res = await sb.auth.updateUser({ password: p1 });
      if (res.error){ alert("비밀번호 설정에 실패했습니다: " + res.error.message); return; }
      pendingPasswordRecovery = false;
      var sess = await sb.auth.getSession();
      await afterLogin(sess.data.session ? sess.data.session.user : null);
    });
  }
  function renderNotEditorScreen(email){
    renderCenteredScreen(
      brandHtml() +
      '<p class="hint" style="margin-bottom:16px;">' + esc(email) + ' 계정은 아직 사용자로 등록되어 있지 않습니다. 관리자에게 등록을 요청해주세요.</p>' +
      '<button class="btn sm" id="btnBackToLogin">로그아웃</button>'
    );
    document.getElementById("btnBackToLogin").addEventListener("click", async function(){
      await sb.auth.signOut();
      renderLoginScreen();
    });
  }
  async function afterLogin(user){
    if (!user){ renderLoginScreen(); return; }
    renderLoadingScreen("사용자 확인 중...");
    var chk = await sb.from("editors").select("id,email,name").eq("id", user.id).maybeSingle();
    if (chk.error || !chk.data){ renderNotEditorScreen(user.email); return; }
    currentUser = { id: user.id, email: user.email, name: chk.data.name || user.email };
    route();
  }

  /* ---------- routing ---------- */
  function parseHash(){
    var parts = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    return { section: parts[0] || "", tab: parts[1] || "" };
  }
  function route(){
    if (!currentUser) return;
    var r = parseHash();
    if (r.section === "settings") return renderShell("settings", renderSettings());
    var cat = findCat(r.section);
    if (cat){
      var tab = null;
      for (var i = 0; i < cat.tabs.length; i++) if (cat.tabs[i].id === r.tab) tab = cat.tabs[i];
      return renderShell(cat.id, renderCategory(cat, tab || cat.tabs[0]));
    }
    renderShell("", renderHome());
  }
  window.addEventListener("hashchange", function(){ route(); window.scrollTo(0, 0); });

  /* ---------- shell (GNB) ---------- */
  function renderShell(activeId, bodyHtml){
    var nav = CATEGORIES.map(function(c){
      return '<a href="#/' + c.id + '"' + (c.id === activeId ? ' class="on" aria-current="page"' : '') + '>' + esc(c.name) + '</a>';
    }).join("");
    document.getElementById("app").innerHTML =
      '<header class="gnb"><div class="gnb-inner">' +
        '<a class="brand" href="#/"><span class="brand-mark">HR</span><span class="brand-name">' + esc(TITLE) + '</span></a>' +
        '<nav class="cat-nav" aria-label="카테고리">' + nav + '</nav>' +
        '<div class="user-box">' +
          '<a class="user-chip" href="#/settings" title="내 계정">' + esc(currentUser.name) + '</a>' +
          '<button class="btn ghost sm" id="btnLogout">로그아웃</button>' +
        '</div>' +
      '</div></header>' +
      '<main class="shell">' + bodyHtml + '</main>';
    document.getElementById("btnLogout").addEventListener("click", async function(){
      if (!confirm("로그아웃할까요?")) return;
      currentUser = null;
      await sb.auth.signOut();
      location.hash = "";
      renderLoginScreen();
    });
    if (activeId === "settings") bindSettings();
  }

  /* ---------- pages ---------- */
  function renderHome(){
    var cards = CATEGORIES.map(function(c){
      return '<a class="svc" href="#/' + c.id + '" style="--c:' + c.color + ';--cbg:' + c.bg + '">' +
          '<div class="svc-icon">' + ICONS[c.id] + '</div>' +
          '<div><h2>' + esc(c.name) + '</h2><p>' + esc(c.desc) + '</p></div>' +
          '<div class="svc-foot"><span>바로가기 →</span><span class="badge">구성 중</span></div>' +
        '</a>';
    }).join("");
    return '<section class="hero"><div>' +
        '<h1>' + esc(currentUser.name) + '님, 안녕하세요</h1>' +
        '<p class="hint">' + esc(todayLabel()) + ' · 관리할 카테고리를 선택하세요.</p>' +
      '</div></section>' +
      '<section class="svc-grid" aria-label="카테고리">' + cards + '</section>';
  }

  function renderCategory(cat, tab){
    var subtabs = cat.tabs.length > 1
      ? '<nav class="subtabs" aria-label="' + esc(cat.name) + ' 메뉴">' + cat.tabs.map(function(t){
          return '<a href="#/' + cat.id + '/' + t.id + '"' + (t.id === tab.id ? ' class="on" aria-current="page"' : '') + '>' + esc(t.name) + '</a>';
        }).join("") + '</nav>'
      : '';
    return '<div style="--c:' + cat.color + ';--cbg:' + cat.bg + '">' +
      '<div class="crumb"><a href="#/">홈</a> › ' + esc(cat.name) + '</div>' +
      '<div class="cat-head"><div class="svc-icon">' + ICONS[cat.id] + '</div>' +
        '<div><h1>' + esc(cat.name) + '</h1><p class="hint">' + esc(cat.desc) + '</p></div></div>' +
      subtabs +
      '<section class="panel empty">' +
        '<div class="svc-icon">' + ICONS[cat.id] + '</div>' +
        '<h2>세부 기능을 구성하고 있습니다</h2>' +
        '<p class="hint">이 카테고리의 화면은 순차적으로 새로 만들어질 예정입니다. 그 전까지는 기존 페이지를 이용해주세요.</p>' +
        '<div class="actions"><a class="btn" href="' + esc(cat.legacyUrl) + '" target="_blank" rel="noopener">기존 페이지 열기 ↗</a></div>' +
      '</section>' +
    '</div>';
  }

  function renderSettings(){
    return '<div style="--c:var(--accent-700);--cbg:var(--accent-100)">' +
      '<div class="crumb"><a href="#/">홈</a> › 내 계정</div>' +
      '<div class="cat-head"><div class="svc-icon">' + ICONS.settings + '</div>' +
        '<div><h1>내 계정</h1><p class="hint">로그인 정보와 비밀번호를 관리합니다.</p></div></div>' +
      '<div class="settings-grid">' +
        '<section class="panel"><h2>계정 정보</h2>' +
          '<dl class="kv"><dt>이름</dt><dd>' + esc(currentUser.name) + '</dd><dt>이메일</dt><dd>' + esc(currentUser.email) + '</dd></dl>' +
        '</section>' +
        '<section class="panel"><h2>비밀번호 변경</h2>' +
          '<p class="hint" style="margin-bottom:12px;">현재 로그인한 계정의 비밀번호만 변경됩니다. 근로감독 관리대장 등 같은 계정을 쓰는 페이지에도 동일하게 적용됩니다.</p>' +
          '<form id="pwChangeForm" class="f">' +
            '<input type="password" id="pwNew1" placeholder="새 비밀번호 (6자 이상)" minlength="6" required autocomplete="new-password">' +
            '<input type="password" id="pwNew2" placeholder="새 비밀번호 확인" minlength="6" required autocomplete="new-password">' +
            '<div class="form-actions"><button type="submit" class="btn primary sm" id="pwChangeBtn">비밀번호 변경</button></div>' +
          '</form>' +
        '</section>' +
      '</div>' +
    '</div>';
  }
  function bindSettings(){
    var form = document.getElementById("pwChangeForm");
    if (!form) return;
    form.addEventListener("submit", async function(e){
      e.preventDefault();
      var p1 = document.getElementById("pwNew1").value;
      var p2 = document.getElementById("pwNew2").value;
      if (p1.length < 6){ alert("비밀번호는 6자 이상이어야 합니다."); return; }
      if (p1 !== p2){ alert("비밀번호 확인이 일치하지 않습니다."); return; }
      var btn = document.getElementById("pwChangeBtn");
      btn.disabled = true;
      var res = await sb.auth.updateUser({ password: p1 });
      btn.disabled = false;
      if (res.error){ alert("비밀번호 변경에 실패했습니다: " + res.error.message); return; }
      form.reset();
      toast("비밀번호가 변경되었습니다.");
    });
  }

  /* ---------- boot ---------- */
  async function boot(){
    if (!sb){
      renderCenteredScreen('<p class="hint">저장소 연결 설정(config.js)이 올바르지 않습니다.</p>');
      return;
    }
    renderLoadingScreen("로그인 확인 중...");
    await new Promise(function(resolve){ setTimeout(resolve, 50); });
    if (pendingPasswordRecovery){ renderSetPasswordScreen(); return; }
    var sess = await sb.auth.getSession();
    if (sess.data.session) await afterLogin(sess.data.session.user);
    else renderLoginScreen();
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
