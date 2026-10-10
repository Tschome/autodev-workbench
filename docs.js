(() => {
  'use strict';

  const docs = Array.isArray(window.WORKBENCH_DOCS) ? window.WORKBENCH_DOCS : [];
  const body = document.getElementById('doc-body');
  const title = document.getElementById('doc-title');
  const sidebar = document.querySelector('.docs-links');
  const search = document.getElementById('doc-search');
  const searchStatus = document.getElementById('docs-search-status');
  const toc = document.getElementById('doc-toc-links');
  const pagination = document.querySelector('.doc-pagination');
  const header = document.querySelector('.site-header');
  const menu = document.querySelector('.menu-toggle');

  menu.hidden = false;
  menu.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(expanded));
    menu.setAttribute('aria-label', expanded ? '关闭导航菜单' : '打开导航菜单');
    header.classList.toggle('menu-expanded', expanded);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', '打开导航菜单');
      header.classList.remove('menu-expanded');
      menu.focus();
    }
  });

  if (!docs.length) {
    body.textContent = '教程暂时未能加载，请刷新页面重试。桌面版“设置 → 手册与指南”也提供产品引导。';
    return;
  }

  function guideLink(id, heading = '') {
    return `docs.html?guide=${encodeURIComponent(id)}${heading ? `#${encodeURIComponent(heading)}` : ''}`;
  }

  function createLink(label, href) {
    const anchor = document.createElement('a');
    anchor.textContent = label;
    anchor.href = href;
    return anchor;
  }

  // Only the authored local docs-content.js provides HTML. URL parameters,
  // search input and document metadata are always inserted as plain text.
  const documentTemplates = new Map();
  const headingOwners = new Map();
  const searchableText = new Map();
  for (const doc of docs) {
    const template = document.createElement('template');
    template.innerHTML = doc.body;
    documentTemplates.set(doc.id, template);
    template.content.querySelectorAll('[id]').forEach((element) => {
      headingOwners.set(element.id, doc.id);
    });
    searchableText.set(doc.id, `${doc.title} ${doc.description} ${template.content.textContent}`.toLocaleLowerCase());
  }

  const requested = new URLSearchParams(window.location.search).get('guide');
  const current = docs.find((doc) => doc.id === requested) || docs[0];
  const currentIndex = docs.indexOf(current);
  document.title = `${current.title} · AutoDev Workbench 使用教程`;
  document.querySelector('meta[name="description"]').content = current.description;
  title.textContent = current.title;
  document.querySelector('.doc-meta').textContent = `${current.category} / 约 ${current.minutes} 分钟`;
  document.querySelector('.doc-description').textContent = current.description;
  body.replaceChildren(documentTemplates.get(current.id).content.cloneNode(true));

  // A bare chapter link can point to another guide. Resolve it against every
  // document's heading IDs, not merely the article currently being rendered.
  body.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    let heading;
    try { heading = decodeURIComponent(anchor.getAttribute('href').slice(1)); }
    catch { return; }
    const owner = headingOwners.get(heading);
    if (owner) anchor.href = guideLink(owner, heading);
  });
  body.querySelectorAll('a[href^="https://github.com/"]').forEach((anchor) => {
    if (!anchor.textContent.includes('权限')) anchor.append('（GitHub，可能需要仓库访问权限）');
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  });

  const navigationLinks = new Map();
  sidebar.replaceChildren();
  for (const doc of docs) {
    const anchor = createLink(doc.title, guideLink(doc.id));
    if (doc.id === current.id) {
      anchor.classList.add('active');
      anchor.setAttribute('aria-current', 'page');
    }
    navigationLinks.set(doc.id, anchor);
    sidebar.append(anchor);
  }

  search.disabled = false;
  search.addEventListener('input', () => {
    const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const doc of docs) {
      const match = terms.every((term) => searchableText.get(doc.id).includes(term));
      navigationLinks.get(doc.id).hidden = !match;
      if (match) count += 1;
    }
    searchStatus.hidden = terms.length === 0;
    searchStatus.textContent = count ? `找到 ${count} 篇教程` : '没有找到匹配教程，请尝试“串口”“烧录”或“MCP”。';
  });

  const headings = [...body.querySelectorAll('h2[id], h3[id]')];
  const tocLinks = new Map();
  for (const heading of headings) {
    const anchor = createLink(heading.textContent, guideLink(current.id, heading.id));
    tocLinks.set(heading.id, anchor);
    toc.append(anchor);
  }

  function markHeading(id) {
    for (const [headingId, anchor] of tocLinks) {
      const active = headingId === id;
      anchor.classList.toggle('active', active);
      if (active) anchor.setAttribute('aria-current', 'location');
      else anchor.removeAttribute('aria-current');
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      if (visible.length) markHeading(visible[0].target.id);
    }, { rootMargin: '-90px 0px -55% 0px', threshold: 0 });
    headings.forEach((heading) => observer.observe(heading));
  }

  function focusChapter() {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); }
    catch { return; }
    if (!id) {
      if (headings[0]) markHeading(headings[0].id);
      return;
    }
    const target = document.getElementById(id);
    if (target && (body.contains(target) || target === title)) {
      target.scrollIntoView({ block: 'start' });
      markHeading(id);
    }
  }
  window.addEventListener('hashchange', focusChapter);
  requestAnimationFrame(focusChapter);

  if (currentIndex > 0) {
    const previous = docs[currentIndex - 1];
    const anchor = createLink(`← 上一篇：${previous.title}`, guideLink(previous.id));
    anchor.rel = 'prev';
    anchor.classList.add('text-link');
    pagination.append(anchor);
  }
  if (currentIndex < docs.length - 1) {
    const next = docs[currentIndex + 1];
    const anchor = createLink(`下一篇：${next.title} →`, guideLink(next.id));
    anchor.rel = 'next';
    anchor.classList.add('text-link');
    pagination.append(anchor);
  }
})();
