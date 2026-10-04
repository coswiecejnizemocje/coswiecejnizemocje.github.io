/* Coś więcej niż emocje – logika strony.
   Treści są w folderze content/ (edytowane w panelu Pages CMS).
   Cały tekst z plików treści trafia na stronę jako zwykły tekst (textContent),
   a linki do sklepów są przepuszczane tylko wtedy, gdy zaczynają się od https://. */
(function () {
  'use strict';

  var data = { books: [], authors: [], talks: [], site: {} };
  var state = { author: null, query: '', lastView: '#/' };
  var MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

  // ---------- pomocnicze ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  function slug(s) {
    return str(s).toLowerCase()
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l').replace(/ń/g, 'n')
      .replace(/ó/g, 'o').replace(/ś/g, 's').replace(/[źż]/g, 'z')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  // Obrazki tylko z tej strony (folder images/)
  function safeImg(p) {
    p = str(p).replace(/^\/+/, '');
    if (!p || p.indexOf('..') !== -1 || !/^[\w\-./ ]+$/.test(p)) return '';
    return encodeURI(p);
  }
  // Linki zewnętrzne tylko https://
  function safeUrl(u) {
    u = str(u);
    if (!u) return '';
    try {
      var url = new URL(u);
      return url.protocol === 'https:' ? url.href : '';
    } catch (e) { return ''; }
  }
  function safeEmail(m) {
    m = str(m);
    return /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(m) ? m : '';
  }
  function safeHandle(h) {
    h = str(h).replace(/^@/, '');
    return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : '';
  }
  function fmtDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(d));
    if (!m) return str(d);
    return parseInt(m[3], 10) + ' ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }
  function img(src, alt) {
    var i = document.createElement('img');
    var s = safeImg(src);
    if (s) i.src = s;
    i.alt = alt || '';
    i.loading = 'lazy';
    i.decoding = 'async';
    return i;
  }
  function getJSON(path) {
    return fetch(path, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(path); return r.json(); })
      .catch(function () { return null; });
  }

  // ---------- normalizacja danych z panelu ----------
  function normBook(b) {
    if (!b || typeof b !== 'object' || !str(b.tytul)) return null;
    var shops = Array.isArray(b.sklepy) ? b.sklepy : [];
    return {
      title: str(b.tytul),
      author: str(b.autorka),
      badge: str(b.etykieta),
      status: str(b.status) === 'nadchodzaca' ? 'upcoming' : 'recent',
      date: str(b.data_premiery),
      cover: b.okladka,
      short: str(b.opis_krotki) || str(b.opis).split('\n')[0],
      desc: str(b.opis),
      shops: shops.map(function (s) { return s && { name: str(s.nazwa), url: safeUrl(s.link) }; })
        .filter(function (s) { return s && s.name && s.url; }),
      extraType: str(b.material_rodzaj),
      extra: str(b.material),
      slug: slug(b.tytul)
    };
  }
  function normAuthor(a) {
    if (!a || !str(a.imie_nazwisko)) return null;
    return { name: str(a.imie_nazwisko), genre: str(a.gatunek), photo: a.zdjecie, instagram: safeHandle(a.instagram), slug: slug(a.imie_nazwisko) };
  }
  function normTalk(t) {
    if (!t || !str(t.tytul)) return null;
    return { type: str(t.rodzaj), title: str(t.tytul), lead: str(t.wstep), body: str(t.tresc), date: str(t.data) };
  }

  // ---------- teksty strony ----------
  function renderSite() {
    var s = data.site;
    $all('[data-field]').forEach(function (node) {
      var v = str(s[node.getAttribute('data-field')]);
      if (node.hasAttribute('data-paragraphs')) {
        node.textContent = '';
        v.split(/\n\s*\n/).forEach(function (p) { if (p.trim()) node.appendChild(el('p', null, p.trim())); });
      } else if (node.hasAttribute('data-quote')) {
        node.textContent = v ? '„' + v.replace(/^[„"]+|[”"]+$/g, '') + '”' : '';
      } else {
        node.textContent = v;
      }
    });
    var mail = safeEmail(s.email);
    $all('[data-mail], [data-mail-plain]').forEach(function (a) {
      if (mail) { a.href = 'mailto:' + mail; if (a.hasAttribute('data-mail')) a.textContent = mail; }
      else a.hidden = true;
    });
    var ig = safeHandle(s.instagram);
    $all('[data-instagram]').forEach(function (a) {
      if (ig) {
        a.href = 'https://www.instagram.com/' + ig + '/';
        if (!a.getAttribute('aria-label')) a.textContent = 'Instagram @' + ig;
      } else a.hidden = true;
    });
    var body = 'Imię i nazwisko / pseudonim:\nTytuł książki:\nWydawnictwo:\nData premiery:\nKrótki opis (3–5 zdań):\n' +
      'Materiał do publikacji (fragment / cytat / rozdział / strona):\nLinki do sklepów:\nOkładka: w załączniku (JPG/PNG)\n\n' +
      'Oświadczam, że mam prawa do przesłanych materiałów i zgadzam się na ich publikację na stronie Coś więcej niż emocje.';
    var sub = $('#submit-mail');
    if (mail) sub.href = 'mailto:' + mail + '?subject=' + encodeURIComponent('Zgłoszenie książki – [TYTUŁ]') + '&body=' + encodeURIComponent(body);
    else sub.hidden = true;
  }

  // ---------- książki ----------
  function coverButton(b, cls) {
    var btn = el('button', cls);
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Otwórz: ' + b.title);
    btn.addEventListener('click', function () { openBook(b.slug); });
    return btn;
  }
  function renderCarousel() {
    var track = $('#carousel');
    track.textContent = '';
    data.books.forEach(function (b) {
      var btn = coverButton(b, 'cover-btn');
      btn.appendChild(img(b.cover, 'Okładka: ' + b.title));
      if (b.badge) btn.appendChild(el('span', 'badge', b.badge));
      track.appendChild(btn);
    });
    var car = track.parentNode;
    var update = function () { car.classList.toggle('static', track.scrollWidth <= track.clientWidth + 4); };
    update();
    window.addEventListener('resize', update);
    $all('[data-car]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = parseInt(btn.getAttribute('data-car'), 10);
        track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
      });
    });
  }
  function allAuthorNames() {
    var names = data.authors.map(function (a) { return a.name; });
    data.books.forEach(function (b) { if (b.author && names.indexOf(b.author) === -1) names.push(b.author); });
    return names;
  }
  function renderChips() {
    var box = $('#chips');
    box.textContent = '';
    var mk = function (label, value) {
      var c = el('button', null, label);
      c.type = 'button';
      c.setAttribute('aria-pressed', String(state.author === value));
      c.addEventListener('click', function () {
        location.hash = value ? '#/ksiazki/autorka/' + slug(value) : '#/ksiazki';
      });
      box.appendChild(c);
    };
    mk('Wszystkie', null);
    allAuthorNames().forEach(function (n) { mk(n, n); });
  }
  function renderBookGrid() {
    var q = state.query.toLowerCase();
    var list = data.books.filter(function (b) {
      return (!state.author || b.author === state.author) &&
        (!q || (b.title + ' ' + b.author).toLowerCase().indexOf(q) !== -1);
    });
    var grid = $('#book-grid');
    grid.textContent = '';
    list.forEach(function (b) {
      var card = coverButton(b, 'book-card');
      card.appendChild(img(b.cover, 'Okładka: ' + b.title));
      card.appendChild(el('span', 't', b.title));
      card.appendChild(el('span', 'a', b.author));
      if (b.short) card.appendChild(el('span', 's', b.short));
      grid.appendChild(card);
    });
    $('#no-results').hidden = list.length > 0;
  }
  function countLabel(n) {
    if (n === 1) return '1 książka';
    var l = n % 10, t = n % 100;
    if (l >= 2 && l <= 4 && (t < 12 || t > 14)) return n + ' książki';
    return n + ' książek';
  }
  function authorCard(a, withCount) {
    var link = el('a', 'author-card');
    link.href = '#/ksiazki/autorka/' + a.slug;
    link.appendChild(img(a.photo, a.name));
    link.appendChild(el('span', 'a-name', a.name));
    var n = data.books.filter(function (b) { return b.author === a.name; }).length;
    var g = withCount ? [a.genre, countLabel(n)].filter(Boolean).join(' · ') : a.genre;
    link.appendChild(el('span', 'a-genre', g));
    return link;
  }
  function renderAuthors() {
    var mini = $('#authors-mini'), grid = $('#author-grid');
    mini.textContent = ''; grid.textContent = '';
    data.authors.slice(0, 4).forEach(function (a) { mini.appendChild(authorCard(a, false)); });
    data.authors.forEach(function (a) { grid.appendChild(authorCard(a, true)); });
  }
  function rowItem(b) {
    var r = coverButton(b, 'row-item');
    r.appendChild(img(b.cover, 'Okładka: ' + b.title));
    var t = el('span');
    t.appendChild(el('span', 'eyebrow', [b.badge, fmtDate(b.date)].filter(Boolean).join(' · ')));
    t.appendChild(el('span', 't', b.title));
    t.appendChild(el('span', 'a', b.author));
    r.appendChild(t);
    return r;
  }
  function renderNews() {
    var byDate = function (dir) {
      return function (a, b) { return dir * ((a.date || '9999').localeCompare(b.date || '9999')); };
    };
    var up = data.books.filter(function (b) { return b.status === 'upcoming'; }).sort(byDate(1));
    var rec = data.books.filter(function (b) { return b.status === 'recent'; }).sort(byDate(-1)).slice(0, 8);
    var u = $('#upcoming'), r = $('#recent');
    u.textContent = ''; r.textContent = '';
    up.forEach(function (b) { u.appendChild(rowItem(b)); });
    rec.forEach(function (b) { r.appendChild(rowItem(b)); });
    $('#no-upcoming').hidden = up.length > 0;
    $('#no-recent').hidden = rec.length > 0;
  }
  function renderTalks() {
    var box = $('#talks');
    box.textContent = '';
    if (!data.talks.length) { box.appendChild(el('p', 'empty', 'Pierwsze rozmowy już wkrótce.')); return; }
    data.talks.forEach(function (t) {
      var a = el('article', 'talk');
      a.appendChild(el('p', 'eyebrow', [t.type, fmtDate(t.date)].filter(Boolean).join(' · ')));
      a.appendChild(el('h3', null, t.title));
      if (t.lead) a.appendChild(el('p', null, t.lead));
      if (t.body) {
        var d = el('details');
        d.appendChild(el('summary', null, 'Czytaj całość'));
        d.appendChild(el('div', 'body', t.body));
        a.appendChild(d);
      }
      box.appendChild(a);
    });
  }

  // ---------- okno książki ----------
  var dlg;
  function openBook(s) {
    var b = data.books.filter(function (x) { return x.slug === s; })[0];
    if (!b) return;
    if (location.hash !== '#/ksiazka/' + s) {
      if (!/^#\/ksiazka\//.test(location.hash)) state.lastView = location.hash || '#/';
      location.hash = '#/ksiazka/' + s;
      return;
    }
    var c = $('#bd-cover');
    var cs = safeImg(b.cover);
    if (cs) c.src = cs; else c.removeAttribute('src');
    c.alt = 'Okładka: ' + b.title;
    $('#bd-meta').textContent = [b.badge, fmtDate(b.date)].filter(Boolean).join(' · ');
    $('#bd-title').textContent = b.title;
    $('#bd-author').textContent = b.author;
    $('#bd-desc').textContent = b.desc;
    var shops = $('#bd-shops');
    shops.textContent = '';
    b.shops.forEach(function (s) {
      var a = el('a', null, s.name + ' ↗');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer nofollow';
      shops.appendChild(a);
    });
    $('#bd-shops-wrap').hidden = b.shops.length === 0;
    $('#bd-extra-type').textContent = (b.extraType || 'Od autorki') + ' · od autorki';
    $('#bd-extra').textContent = b.extra;
    $('#bd-extra-wrap').hidden = !b.extra;
    document.title = b.title + ' – Coś więcej niż emocje';
    if (!dlg.open) dlg.showModal();
  }
  function closeBook() {
    if (dlg.open) dlg.close();
  }

  // ---------- nawigacja ----------
  var VIEWS = ['home', 'ksiazki', 'autorki', 'nowosci', 'rozmowy', 'dla-autorek', 'o-nas', 'polityka-prywatnosci'];
  function showView(name) {
    $all('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
    $all('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean).map(function (p) { return decodeURIComponent(p); });
    $('#menu').classList.remove('open');
    $('.menu-toggle').setAttribute('aria-expanded', 'false');

    if (parts[0] === 'ksiazka' && parts[1]) {
      var under = state.lastView.replace(/^#\/?/, '').split('/')[0] || 'home';
      showView(VIEWS.indexOf(under) !== -1 ? under : 'home');
      openBook(parts[1]);
      return;
    }
    closeBook();
    document.title = 'Coś więcej niż emocje';
    var name = parts[0] || 'home';
    if (VIEWS.indexOf(name) === -1) name = '404';
    if (name === 'ksiazki') {
      var a = parts[1] === 'autorka' && parts[2] ? parts[2] : null;
      state.author = a ? (allAuthorNames().filter(function (n) { return slug(n) === a; })[0] || null) : null;
      renderChips();
      renderBookGrid();
    }
    showView(name);
    state.lastView = location.hash || '#/';
    window.scrollTo(0, 0);
  }

  // ---------- start ----------
  function init() {
    dlg = $('#book-dialog');
    $('#bd-close').addEventListener('click', function () { location.hash = state.lastView || '#/'; });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); location.hash = state.lastView || '#/'; });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) location.hash = state.lastView || '#/'; });

    var tgl = $('.menu-toggle');
    tgl.addEventListener('click', function () {
      var open = $('#menu').classList.toggle('open');
      tgl.setAttribute('aria-expanded', String(open));
    });
    $('#q').addEventListener('input', function (e) { state.query = e.target.value.trim(); renderBookGrid(); });

    Promise.all([
      getJSON('content/ksiazki.json'), getJSON('content/autorki.json'),
      getJSON('content/rozmowy.json'), getJSON('content/strona.json')
    ]).then(function (r) {
      data.books = (Array.isArray(r[0]) ? r[0] : []).map(normBook).filter(Boolean);
      data.authors = (Array.isArray(r[1]) ? r[1] : []).map(normAuthor).filter(Boolean);
      data.talks = (Array.isArray(r[2]) ? r[2] : []).map(normTalk).filter(Boolean);
      data.site = r[3] && typeof r[3] === 'object' ? r[3] : {};
      renderSite();
      renderCarousel();
      renderAuthors();
      renderNews();
      renderTalks();
      window.addEventListener('hashchange', route);
      route();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
