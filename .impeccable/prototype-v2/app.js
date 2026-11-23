(() => {
  'use strict';

  const icons = {
    inbox: '<path d="M3 4h12l2 7v5H1v-5z"/><path d="M1 11h4l2 3h4l2-3h4"/>',
    layers: '<path d="m9 1 8 4-8 4-8-4z"/><path d="m1 9 8 4 8-4M1 13l8 4 8-4"/>',
    file: '<path d="M4 1h7l4 4v12H4z"/><path d="M11 1v5h4M7 10h5M7 13h5"/>',
    bell: '<path d="M3 12h12l-2-3V6a4 4 0 0 0-8 0v3zM7 16h4"/>',
    settings: '<path d="m7 1-.6 2-2 .7-1.8-1L1 5l1.3 1.8-.3 2.3-1.8 1 .8 2.8 2.2-.1 1.8 1.5.3 2.2h3l.7-2.1 2.1-.8 1.8 1L17 12l-1.2-1.8.2-2.3 1.8-1-.8-2.8-2.2.1L13 2.7 12.7.5z"/><circle cx="9" cy="8.5" r="2.5"/>',
    search: '<circle cx="7.5" cy="7.5" r="5.5"/><path d="m12 12 4 4"/>',
    chevron: '<path d="m6 3 6 6-6 6"/>',
    down: '<path d="m4 7 5 5 5-5"/>',
    plus: '<path d="M9 3v12M3 9h12"/>',
    arrow: '<path d="M2 9h13m-5-5 5 5-5 5"/>',
    back: '<path d="M16 9H3m5-5-5 5 5 5"/>',
    external: '<path d="M10 2h6v6M16 2l-9 9"/><path d="M7 3H3v13h13v-4"/>',
    upload: '<path d="M9 12V2M5 6l4-4 4 4M2 12v4h14v-4"/>',
    check: '<path d="m3 9 4 4L15 4"/>',
    circle: '<circle cx="9" cy="9" r="6.5"/>',
    clock: '<circle cx="9" cy="9" r="7"/><path d="M9 4v5l3 2"/>',
    info: '<circle cx="9" cy="9" r="7"/><path d="M9 8v5M9 5h.01"/>',
    shield: '<path d="m9 1 6 3v5c0 4-6 8-6 8S3 13 3 9V4z"/><path d="m6 9 2 2 4-4"/>',
    mail: '<rect x="1" y="3" width="16" height="12" rx="2"/><path d="m2 4 7 6 7-6"/>',
    sun: '<circle cx="9" cy="9" r="3"/><path d="M9 0v2m0 14v2M0 9h2m14 0h2M2.6 2.6 4 4m10 10 1.4 1.4M2.6 15.4 4 14M14 4l1.4-1.4"/>',
    moon: '<path d="M16 10A7 7 0 0 1 8 2a7 7 0 1 0 8 8Z"/>',
    refresh: '<path d="M15 5a7 7 0 1 0 1 7M15 1v5h-5"/>',
    close: '<path d="m4 4 10 10M14 4 4 14"/>',
    package: '<path d="m9 1 7 4v8l-7 4-7-4V5zM2 5l7 4 7-4M9 9v8M5.5 3l7 4"/>',
    warning: '<path d="M9 1 1 16h16z"/><path d="M9 6v4m0 3h.01"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 18 18" aria-hidden="true">${icons[name] || icons.circle}</svg>`;
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const storageKey = 'wisesama-workflow-mockup-v2';
  const initialHash = location.hash.slice(1).split('?')[0];
  const directDemo = new URLSearchParams(location.search).get('demo') === '1' || (initialHash && !['setup', 'import', 'scan'].includes(initialHash));
  let theme = localStorage.getItem('wisesama-mockup-theme') || 'dark';
  let state = {
    projectName: 'production-api', environment: 'production',
    imported: directDemo, fileName: 'package-lock.json', sample: true,
    hasScan: directDemo, selected: 'WS-104', search: '', projectFilter: 'all',
    severityFilter: 'all', tab: 'open', emailEnabled: false,
    deliveries: [], error: '', evidence: '', scanStep: -1,
    findingStatus: {}, history: {}, toast: '',
  };
  try { const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); if (saved && saved.version === 2) state = { ...state, ...saved.state, error: '', toast: '' }; } catch { /* A corrupt prototype session starts cleanly. */ }
  if (directDemo) { state.imported = true; state.hasScan = true; }
  const samplePackages = [
    { name: 'lodash', version: '4.17.20', ecosystem: 'npm' },
    { name: 'next', version: '15.2.2', ecosystem: 'npm' },
    { name: 'react', version: '18.3.1', ecosystem: 'npm' },
    { name: 'typescript', version: '5.6.3', ecosystem: 'npm' },
  ];
  let importedPackages = Array.isArray(state.inventory) ? state.inventory : [...samplePackages];
  const records = [
    { id: 'WS-104', title: 'Command injection in lodash', cve: 'CVE-2021-23337', ghsa: 'GHSA-35jh-r3h4-6jhm', package: 'lodash', installed: '4.17.20', fixed: '4.17.21', project: 'production-api', severity: 'high',
      summary: 'The template function in affected lodash versions can allow command injection. This finding matches a package version in the sample inventory; it does not establish that the vulnerable function is reachable.',
      source: 'https://github.com/advisories/GHSA-35jh-r3h4-6jhm' },
    { id: 'WS-105', title: 'Authorization bypass in Next.js middleware', cve: 'CVE-2025-29927', ghsa: 'GHSA-f82v-jwr5-mffw', package: 'next', installed: '15.2.2', fixed: '15.2.3', project: 'marketing-web', severity: 'critical',
      summary: 'An authorization bypass affects middleware in these Next.js versions. Whether a deployment is exposed depends on its configuration and use of middleware for authorization.',
      source: 'https://github.com/advisories/GHSA-f82v-jwr5-mffw' },
    { id: 'WS-106', title: 'Regular expression denial of service in lodash', cve: 'CVE-2020-28500', ghsa: 'GHSA-29mw-wpgm-hmr9', package: 'lodash', installed: '4.17.20', fixed: '4.17.21', project: 'legacy-checkout', severity: 'medium',
      summary: 'Affected lodash versions contain a regular expression denial-of-service issue. Assess whether untrusted input reaches the relevant functions in the deployed application.',
      source: 'https://github.com/advisories/GHSA-29mw-wpgm-hmr9' },
  ];
  const assessmentRecords = () => records.filter((item) => importedPackages.some((pkg) => pkg.ecosystem === 'npm' && pkg.name === item.package && pkg.version === item.installed));
  const record = () => records.find((item) => item.id === state.selected) || records[0];
  const statusOf = (item) => state.findingStatus[item.id] || 'open';
  const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
  const projectName = () => state.projectName;
  const openRecords = () => assessmentRecords().filter((item) => statusOf(item) !== 'resolved');
  const resolvedRecords = () => assessmentRecords().filter((item) => statusOf(item) === 'resolved');
  const save = () => sessionStorage.setItem(storageKey, JSON.stringify({ version: 2, state }));
  const announce = (message) => { document.getElementById('live').textContent = message; };
  const go = (view) => { location.hash = view; };
  const button = (label, action, primary = false, extra = '') => `<button class="button${primary ? ' primary' : ''}" data-action="${action}" ${extra}>${label}</button>`;
  const statusLabel = (item) => { const value = statusOf(item); return `<span class="state ${value}">${icon(value === 'resolved' ? 'check' : value === 'investigating' ? 'clock' : 'circle')}${value === 'resolved' ? 'Resolved' : value === 'investigating' ? 'Investigating' : 'Open'}</span>`; };
  const severity = (item) => `<span class="severity ${item.severity === 'critical' ? 'high' : item.severity}"><span class="bar"></span>${titleCase(item.severity)}</span>`;
  const heading = (title, subtitle = '', actions = '') => `<div class="page-heading"><div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
  const projectContext = () => `<div class="project-context">${icon('package')}<strong>${escape(state.projectName)}</strong><span class="environment">${escape(state.environment)}</span></div>`;
  const warning = (title, text, type = '') => `<div class="notice ${type}">${icon(type === 'error' ? 'warning' : 'info')}<div>${title ? `<strong>${title}</strong>` : ''}${text}</div></div>`;

  function steps(current) {
    return `<ol class="step-list">${['Project details', 'Review inventory', 'First assessment'].map((name, i) => `<li class="${i === current ? 'current' : i < current ? 'done' : ''}"><span class="step-number">${i < current ? icon('check') : i + 1}</span><div><strong>${name}</strong><small>${['Name and environment', 'Check the imported versions', 'Review relevant findings'][i]}</small></div></li>`).join('')}</ol>`;
  }

  function sidebar(active) {
    return `<aside class="sidebar" aria-label="Main navigation"><a href="#inbox" class="brand" aria-label="Wisesama home"><img src="assets/logo${theme === 'light' ? '-light' : ''}.svg" alt="Wisesama" /></a><div class="workspace"><strong>Acme Engineering</strong>Sample workspace</div><nav class="nav"><a href="#inbox" class="${active === 'inbox' ? 'active' : ''}">${icon('inbox')}Inbox<span class="count">${state.hasScan ? openRecords().length : ''}</span></a><a href="#projects" class="${active === 'projects' ? 'active' : ''}">${icon('layers')}Projects</a><a href="#briefings" class="${active === 'briefings' ? 'active' : ''}">${icon('file')}Briefings</a></nav><div class="sidebar-bottom"><nav class="nav"><a href="#notifications" class="${active === 'notifications' ? 'active' : ''}">${icon('bell')}Notifications</a></nav><div class="profile"><span class="avatar">AM</span><div>Alex Morgan<small>alex@example.com</small></div></div></div></aside>`;
  }

  function shell(view, content) {
    const names = { setup: 'New project', import: 'New project', scan: 'New project', inbox: 'Inbox', finding: record().id, resolve: record().id, resolved: 'Resolved', projects: 'Projects', briefings: 'Briefings', notifications: 'Notifications' };
    const active = ['finding', 'resolve', 'resolved', 'inbox'].includes(view) ? 'inbox' : ['setup', 'import', 'scan', 'projects'].includes(view) ? 'projects' : view;
    const parent = ['finding', 'resolve'].includes(view) ? '<a href="#inbox">Inbox</a>' : `<span class="root-label">Workspace</span>`;
    return `<div class="shell">${sidebar(active)}<header class="topbar"><div class="breadcrumb">${parent}${icon('chevron')}<span class="current">${escape(names[view])}</span></div><div class="top-actions"><span class="source-state"><span class="dot purple"></span>Historical sample advisories</span></div></header><nav class="mobile-nav" aria-label="Mobile navigation"><a href="#inbox" class="${active === 'inbox' ? 'active' : ''}">Inbox</a><a href="#projects" class="${active === 'projects' ? 'active' : ''}">Projects</a><a href="#briefings" class="${active === 'briefings' ? 'active' : ''}">Briefings</a><a href="#notifications" class="${active === 'notifications' ? 'active' : ''}">Notifications</a></nav><main id="main" class="content ${['finding', 'resolve'].includes(view) ? 'detail-content' : ''}" tabindex="-1">${content}</main><footer class="prototype-bar"><span>Interactive mockup <span class="label-detail">· sample data · no live scans or emails</span></span><div class="controls"><button data-action="restart">${icon('refresh')}Restart flow</button><button data-action="theme" aria-label="Switch to ${theme === 'dark' ? 'light' : 'dark'} mode">${icon(theme === 'dark' ? 'sun' : 'moon')}${theme === 'dark' ? 'Light' : 'Dark'} mode</button></div></footer>${state.toast ? `<div class="toast" role="status">${icon('check')}<span>${escape(state.toast)}</span>${button('Undo', 'undo')}</div>` : ''}</div>`;
  }

  function setupView() {
    return `<div class="setup-layout">${steps(0)}<section class="setup-body"><h1>Add your first project</h1><p>Start with one service. Its package inventory tells Wisesama which advisories to assess.</p><form id="project-form" class="form-block"><div class="field"><label for="project-name">Project name</label><input id="project-name" class="input" name="projectName" value="${escape(state.projectName)}" placeholder="production-api" maxlength="100" required /><p class="field-help">Use the name your team recognizes.</p></div><div class="field"><label for="environment">Environment</label><select class="select" id="environment" name="environment">${['production', 'staging', 'development'].map((item) => `<option value="${item}" ${item === state.environment ? 'selected' : ''}>${titleCase(item)}</option>`).join('')}</select></div><div class="form-actions"><span class="muted"><small>Next: import your package inventory</small></span><button type="submit" class="button primary">Continue ${icon('arrow')}</button></div></form><div class="annotation">${icon('shield')}<span>No repository access or credentials are needed for an inventory upload.</span></div></section></div>`;
  }

  function importView() {
    const packages = importedPackages.length ? importedPackages : samplePackages;
    return `<div class="setup-layout">${steps(1)}<section class="setup-body"><h1>Review your inventory</h1>${projectContext()}${state.error ? warning('', escape(state.error), 'error') : ''}${state.imported ? `<div class="import-file"><span class="file-icon">${icon('file')}</span><div><div class="file-name">${escape(state.fileName)}</div><div class="file-meta">${state.sample ? 'Sample file · ' : 'Read locally · '}${packages.length} exact package versions</div></div>${button('Replace', 'replace-file')}</div><div class="import-summary"><strong>${packages.length} packages ready</strong><span class="muted">npm${packages.some((item) => item.ecosystem === 'PyPI') ? ' / PyPI' : ''}</span><span class="muted">Exact versions only</span></div><table class="mini-table"><thead><tr><th>Package</th><th>Installed version</th><th>Ecosystem</th></tr></thead><tbody>${packages.slice(0, 6).map((item) => `<tr><td><code>${escape(item.name)}</code></td><td><code>${escape(item.version)}</code></td><td>${escape(item.ecosystem)}</td></tr>`).join('')}</tbody></table>${packages.length > 6 ? `<p class="field-help">And ${packages.length - 6} more exact package versions.</p>` : ''}${warning('What this inventory can tell us', 'An imported package match is not proof of production exposure. Runtime versions, container images and code reachability are outside this assessment.')}` : `<div class="drop-zone" id="drop-zone"><div class="drop-icon">${icon('upload')}</div><h2>Drop your inventory here</h2><p>Upload a lockfile or a pinned package list.</p>${button('Choose file', 'choose-file')}<div class="supported">package-lock.json · pnpm-lock.yaml · inventory.json<br />Up to 2 MB · 2,000 package versions</div></div><div class="sample-line">No inventory at hand? <button data-action="sample">Use sample inventory</button></div>`}<input type="file" id="inventory-file" class="sr-only" accept=".json,.yaml,.yml" tabindex="-1" /><div class="annotation">${icon('info')}<span>${state.sample && state.imported ? 'This sample stays in your browser. ' : 'Files stay in your browser in this mockup. '}In the live product, package names and versions are sent to OSV for matching. Source code is not uploaded.</span></div><div class="form-actions"><a href="#setup" class="button ghost">${icon('back')}Back</a><button class="button primary" data-action="start-scan" ${state.imported ? '' : 'disabled'}>Create project & scan ${icon('arrow')}</button></div></section></div>`;
  }

  function scanView() {
    const complete = state.scanStep >= 3;
    return `<div class="setup-layout">${steps(2)}<section class="setup-body"><h1>${complete ? 'Your sample assessment is ready' : 'Assessing your inventory'}</h1>${projectContext()}<p>This walkthrough simulates each source check. No live requests are made.</p><ul class="scan-list">${[
      ['OSV', 'Package matching', 'Exact package names and versions', 'Package matches prepared'],
      ['KEV', 'CISA known exploitation', 'Evidence separate from severity', 'Not checked in this mockup'],
      ['EPSS', 'Exploitation forecast', 'A forecast, not observed exploitation', 'Not checked in this mockup'],
    ].map(([label, name, detail, result], i) => `<li><div class="scan-source"><span class="source-symbol">${label}</span><div>${name}<small>${detail}</small></div></div><span class="source-result ${state.scanStep > i ? 'complete' : state.scanStep === i ? 'running' : ''}">${state.scanStep > i ? (i ? result : icon('check') + ' ' + result) : state.scanStep === i ? '<span class="spinner"></span>Simulating' : 'Queued'}</span></li>`).join('')}</ul>${complete ? `<div class="scan-result"><h2>${assessmentRecords().length} sample findings to review</h2><p>This demonstration checks only three historical advisories against the imported package versions. It is not a complete security assessment.</p></div>` : ''}<div class="form-actions"><a href="#import" class="button ghost">${icon('back')}Inventory</a><button class="button primary" data-action="view-findings" ${complete ? '' : 'disabled'}>View findings ${icon('arrow')}</button></div></section></div>`;
  }

  function inboxView(resolved = false) {
    if (!state.hasScan) return `${heading('Inbox')}<div class="empty-state">${icon('inbox')}<h2>Your first assessment starts with a project</h2><p>Import an inventory to see which advisories match the package versions you run.</p><a class="button primary" href="#setup">Add project ${icon('arrow')}</a></div>`;
    const mode = resolved ? 'resolved' : state.tab;
    const base = mode === 'resolved' ? resolvedRecords() : openRecords();
    const filtered = base.filter((item) => (!state.search || [item.title, item.cve, item.package, projectName(item)].some((text) => text.toLowerCase().includes(state.search.toLowerCase()))) && (state.projectFilter === 'all' || projectName(item) === state.projectFilter) && (state.severityFilter === 'all' || item.severity === state.severityFilter));
    return `<div class="page-heading inbox-heading"><div><h1>Inbox <span class="count-inline">${openRecords().length}</span></h1><p>Findings matched to your imported package versions.</p></div><div class="heading-actions"><a href="#setup" class="button">${icon('plus')}Add project</a></div></div><div class="tabs" role="tablist" aria-label="Finding status"><button role="tab" aria-selected="${mode !== 'resolved'}" class="${mode !== 'resolved' ? 'active' : ''}" data-action="open-tab">Needs response <span class="tab-count">${openRecords().length}</span></button><button role="tab" aria-selected="${mode === 'resolved'}" class="${mode === 'resolved' ? 'active' : ''}" data-action="resolved-tab">Resolved <span class="tab-count">${resolvedRecords().length}</span></button></div><div class="toolbar"><div class="filters"><label class="sr-only" for="project-filter">Project filter</label><select class="filter-select" id="project-filter"><option value="all">All projects</option>${[...new Set(records.map(projectName))].map((name) => `<option ${state.projectFilter === name ? 'selected' : ''}>${escape(name)}</option>`).join('')}</select><label class="sr-only" for="severity-filter">Severity filter</label><select class="filter-select" id="severity-filter"><option value="all">All severities</option>${['critical', 'high', 'medium'].map((name) => `<option value="${name}" ${state.severityFilter === name ? 'selected' : ''}>${titleCase(name)}</option>`).join('')}</select></div><label class="search-wrap" for="finding-search">${icon('search')}<input id="finding-search" type="search" value="${escape(state.search)}" placeholder="Search findings" /></label></div>${filtered.length ? `<table class="finding-table"><colgroup><col/><col/><col/><col/><col/></colgroup><thead><tr><th>Finding / package</th><th>Project</th><th>Severity</th><th>Exploitation evidence</th><th>Response</th></tr></thead><tbody>${filtered.map((item) => `<tr data-row="${item.id}"><td><a href="#finding" class="finding-title" data-finding="${item.id}">${escape(item.title)}</a><div class="finding-sub"><code>${item.package} ${item.installed}</code><span class="finding-id">${item.cve}</span></div></td><td>${escape(projectName(item))}</td><td>${severity(item)}</td><td><span class="kev">${icon('info')}Not checked</span></td><td>${statusLabel(item)}</td></tr>`).join('')}</tbody></table><div class="table-footer"><span>${filtered.length} ${filtered.length === 1 ? 'finding' : 'findings'} · historical sample data</span><span>Package inventory matches · deployment not verified</span></div>` : `<div class="empty-state">${icon(mode === 'resolved' ? 'check' : 'search')}<h2>${mode === 'resolved' && !state.search ? 'No findings resolved yet' : !assessmentRecords().length ? 'No demonstration advisories matched' : 'No findings match these filters'}</h2><p>${mode === 'resolved' && !state.search ? 'Record the response and supporting evidence on a finding to close it.' : !assessmentRecords().length ? 'This mockup checks only three historical advisories. Try the sample inventory to explore the response workflow. This result is not a complete security assessment.' : 'Try another search or clear your project and severity filters.'}</p>${state.search || state.projectFilter !== 'all' || state.severityFilter !== 'all' ? button('Clear filters', 'clear-filters') : mode === 'resolved' ? button('View findings needing response', 'open-tab') : ''}</div>`}<div class="queue-note"><p>Keep the news separate from your response. A briefing can be stable while a finding is still open.</p><a href="#notifications" class="text-link">Set up email alerts ${icon('arrow')}</a></div>`;
  }

  function findingView(resolving = false) {
    const item = record();
    const value = statusOf(item);
    const events = state.history[item.id] || [];
    return `<div class="detail-topline"><a href="#${value === 'resolved' ? 'resolved' : 'inbox'}" class="text-link">${icon('back')}Back to ${value === 'resolved' ? 'resolved' : 'inbox'}</a><span>${item.id} · historical sample finding</span></div><div class="detail-layout"><article class="detail-main"><h1 class="finding-heading">${item.title}</h1><p class="finding-summary">${item.summary}</p><div class="detail-statusbar">${statusLabel(item)}${resolving ? '' : value === 'resolved' ? button('Reopen finding', 'reopen') : value === 'investigating' ? `<a class="button primary" href="#resolve">Record resolution ${icon('arrow')}</a>` : button('Start investigation ' + icon('arrow'), 'investigate', true)}</div>${resolving ? `<form id="resolution-form" class="resolution-form"><h2>Record your resolution</h2><p>Describe the deployed fix and how you checked it. This records your team's evidence; Wisesama has not independently verified the deployment.</p><div class="field"><label for="resolution-evidence">Verification evidence</label><textarea id="resolution-evidence" class="textarea" minlength="10" placeholder="For example: upgraded lodash to 4.17.21, redeployed build a81c2f, and confirmed the installed version in production." required>${escape(state.evidence)}</textarea><div class="char-count" id="evidence-count">At least 10 characters${state.evidence ? ` · ${state.evidence.length} entered` : ''}</div></div>${state.error ? warning('', escape(state.error), 'error') : ''}<div class="resolution-footer"><small>Recorded as user-attested evidence</small><div class="buttons"><a href="#finding" class="button ghost">Cancel</a><button class="button primary" type="submit">Record resolution</button></div></div></form>` : ''}<section class="detail-section"><div class="section-title"><h2>Why this matches</h2><a href="#import" class="text-link">View inventory ${icon('external')}</a></div><div class="evidence-table"><div class="evidence-row"><span>Imported package</span><code>${item.package}@${item.installed}</code></div><div class="evidence-row"><span>Advisory</span><code>${item.cve}</code></div><div class="evidence-row"><span>First fixed version</span><code>${item.fixed}</code></div><div class="evidence-row"><span>Inventory source</span><span>${escape(state.fileName)} · sample timestamp, 09:42</span></div></div><p class="evidence-scope">${icon('info')}This is a version match. Confirm that this version is deployed and the affected functionality is in use. The first fixed version is historical; follow current vendor guidance.</p></section><section class="detail-section"><div class="section-title"><h2>Suggested response</h2></div><ol class="response-steps"><li><span class="check-outline"></span><div><strong>Confirm the deployed package</strong>Check the running service, not only the repository lockfile.</div></li><li><span class="check-outline"></span><div><strong>Apply the vendor's recommended update</strong>Rebuild, test and redeploy the affected service.</div></li><li><span class="check-outline"></span><div><strong>Record the deployed version and verification</strong>Keep a build reference or deployment check with this finding.</div></li></ol><div class="source-links"><a href="${item.source}" class="text-link" target="_blank" rel="noopener noreferrer">GitHub advisory ${icon('external')}</a><a href="https://osv.dev/vulnerability/${item.ghsa}" class="text-link" target="_blank" rel="noopener noreferrer">OSV record ${icon('external')}</a></div></section><section class="detail-section"><div class="section-title"><h2>Activity</h2><span class="quiet"><small>Response history</small></span></div><ol class="activity">${events.map((event) => `<li><span class="activity-mark accent"></span><div class="activity-text"><strong>Alex Morgan</strong> ${escape(event.text)}${event.evidence ? `<p>${escape(event.evidence)}</p>` : ''}</div><span class="activity-time">Just now</span></li>`).join('')}<li><span class="activity-mark"></span><div class="activity-text"><strong>Wisesama</strong> matched the imported package version</div><span class="activity-time">09:42</span></li><li><span class="activity-mark"></span><div class="activity-text"><strong>Alex Morgan</strong> imported ${escape(state.fileName)}</div><span class="activity-time">09:41</span></li></ol></section></article><aside class="properties" aria-label="Finding properties"><h2>Finding details</h2><div class="property"><div class="property-label">Project</div><span>${escape(projectName(item))}</span></div><div class="property"><div class="property-label">Environment</div><span class="environment">${escape(state.environment)}</span></div><div class="property"><div class="property-label">Response</div>${statusLabel(item)}${value === 'resolved' ? '<p>User attested. Deployment not independently verified.</p>' : ''}</div><hr class="divider"/><div class="property"><div class="property-label">Technical severity</div>${severity(item)}</div><div class="property"><div class="property-label">Known exploitation</div><span class="state">${icon('info')}Not checked in mockup</span><p>Separate from severity. No CISA membership claim is made here.</p></div><div class="property"><div class="property-label">Exploitation forecast</div><span class="muted">Not checked in mockup</span></div><hr class="divider"/><div class="property"><div class="property-label">Responding as</div><div class="owner-line"><span class="avatar">AM</span>Alex Morgan</div></div><div class="property"><div class="property-label">Scope</div><p>Imported npm package version. Runtime and code reachability are not assessed.</p></div></aside></div>`;
  }

  function notificationsView() {
    return `<div class="settings-layout">${heading('Notifications', 'Choose where your security updates go.')}<section class="settings-group"><h2>Account email</h2><p>Security alerts go only to your verified account address.</p><div class="email-display">${icon('mail')}alex@example.com<span class="verified">${icon('check')}Verified sample address</span></div></section><section class="settings-group"><div class="settings-row"><div><strong>Email security alerts</strong><p>New inventory matches and meaningful changes to existing findings.</p></div><button class="toggle" role="switch" aria-label="Email security alerts" aria-checked="${state.emailEnabled}" data-action="toggle-email"></button></div>${state.emailEnabled ? `<div class="delivery-rule">${icon('bell')}<div><strong>New matches & advisory changes</strong><br/><span>Relevant to your imported package versions</span></div><span class="right">via email</span></div>` : ''}<div class="settings-footer"><p><small>Frequency depends on source refresh and delivery availability.</small></p>${button('Simulate test delivery', 'test-email', false, state.emailEnabled ? '' : 'disabled')}</div>${!state.emailEnabled ? '<p class="field-help">Enable email alerts to try a simulated delivery.</p>' : ''}</section><section class="settings-group"><div class="section-title"><h2>Delivery history</h2><span class="demo-tag">Simulation only</span></div>${state.deliveries.length ? `<table class="history-table"><thead><tr><th>Message</th><th>Channel</th><th>Result</th></tr></thead><tbody>${state.deliveries.map(() => `<tr><td>Test notification<small class="muted" style="display:block">Just now · alex@example.com</small></td><td>Email</td><td><span class="state resolved">${icon('check')}Simulated</span></td></tr>`).join('')}</tbody></table>` : `<p>No deliveries yet. A simulated test will appear here.</p>`}</section><div class="annotation">${icon('info')}<span>No messages leave your browser in this mockup. Additional channels are outside this first workflow.</span></div></div>`;
  }

  function projectsView() {
    return `${heading('Projects', 'Software inventories and their assessment coverage.', '<a href="#setup" class="button primary">' + icon('plus') + 'Add project</a>')}${!state.hasScan ? `<div class="empty-state">${icon('layers')}<h2>Start with one project</h2><p>Import a lockfile or pinned inventory for a service your team maintains.</p><a class="button primary" href="#setup">Add project ${icon('arrow')}</a></div>` : `<div class="project-list">${[state.projectName].map((name, i) => { const items = assessmentRecords().filter((item) => projectName(item) === name); return `<div class="project-item"><div><div class="project-name">${icon('package')}${escape(name)}</div><p>npm inventory · ${i ? 'sample import' : escape(state.fileName)}</p></div><div class="project-field"><small>Environment</small><span class="environment">${i ? 'production' : escape(state.environment)}</span></div><div class="project-field"><small>Needs response</small>${items.filter((item) => statusOf(item) !== 'resolved').length} finding</div><a href="#inbox" class="button" data-project="${escape(name)}">View findings ${icon('arrow')}</a></div>`; }).join('')}</div><div class="annotation">${icon('info')}<span>This project shows package-version coverage only. Running deployments have not been verified.</span></div>`}`;
  }

  function briefingsView() {
    return `${heading('Briefings', 'Public advisories, separate from your project response.')}<div class="briefing-list">${records.map((item) => `<article class="briefing-item"><div class="briefing-date">Historical<br/>advisory</div><div><h2>${escape(item.title)}</h2><p>${item.summary}</p><a href="${item.source}" class="text-link" target="_blank" rel="noopener noreferrer">Read source advisory ${icon('external')}</a>${state.hasScan && assessmentRecords().some((match) => match.id === item.id) ? `<a href="#finding" data-finding="${item.id}" class="text-link" style="margin-left:20px">View your finding ${icon('arrow')}</a>` : ''}</div>${severity(item)}</article>`).join('')}</div><div class="annotation">${icon('info')}<span>This mockup uses a fixed set of historical advisories to demonstrate the workflow. It is not today's live feed.</span></div>`;
  }

  let scanTimers = [];
  function render() {
    const route = location.hash.slice(1).split('?')[0] || 'setup';
    const view = ['setup', 'import', 'scan', 'inbox', 'finding', 'resolve', 'resolved', 'notifications', 'projects', 'briefings'].includes(route) ? route : 'setup';
    document.documentElement.dataset.theme = theme;
    document.title = `Wisesama · ${view === 'setup' ? 'Add project' : titleCase(view)} mockup`;
    const views = { setup: setupView, import: importView, scan: scanView, inbox: () => inboxView(), resolved: () => inboxView(true), finding: () => findingView(), resolve: () => findingView(true), notifications: notificationsView, projects: projectsView, briefings: briefingsView };
    document.getElementById('app').innerHTML = shell(view, views[view]());
    bind(view);
    if (view === 'scan' && state.scanStep < 0) startScanAnimation();
    if (view !== 'scan') { scanTimers.forEach(clearTimeout); scanTimers = []; }
    save();
  }

  function startScanAnimation() {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.scanStep = 0;
    render();
    for (let index = 1; index <= 3; index++) scanTimers.push(setTimeout(() => { state.scanStep = index; if (index === 3) state.hasScan = true; render(); }, reduced ? index * 10 : index * 650));
  }

  function addEvent(id, text, evidence = '') {
    state.history[id] = [{ text, evidence }, ...(state.history[id] || [])];
  }

  function action(name) {
    state.error = '';
    if (name === 'theme') { theme = theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('wisesama-mockup-theme', theme); render(); return; }
    if (name === 'restart') { sessionStorage.removeItem(storageKey); importedPackages = [...samplePackages]; state = { ...state, imported: false, inventory: samplePackages, fileName: 'package-lock.json', sample: true, hasScan: false, findingStatus: {}, history: {}, evidence: '', scanStep: -1, error: '', toast: '', tab: 'open', search: '', projectFilter: 'all', severityFilter: 'all', deliveries: [], emailEnabled: false }; go('setup'); render(); return; }
    if (name === 'choose-file' || name === 'replace-file') { document.getElementById('inventory-file').click(); return; }
    if (name === 'sample') { importedPackages = [...samplePackages]; state.imported = true; state.sample = true; state.fileName = 'package-lock.json'; state.inventory = importedPackages; render(); announce('Sample inventory loaded. Four package versions are ready to review.'); return; }
    if (name === 'start-scan') { if (!state.imported) return; state.findingStatus = {}; state.history = {}; state.scanStep = -1; go('scan'); return; }
    if (name === 'view-findings') { state.hasScan = true; state.tab = 'open'; state.projectFilter = 'all'; state.search = ''; state.severityFilter = 'all'; go('inbox'); return; }
    if (name === 'open-tab' || name === 'resolved-tab') { state.tab = name === 'resolved-tab' ? 'resolved' : 'open'; state.toast = ''; if (location.hash === '#resolved') go('inbox'); else render(); return; }
    if (name === 'clear-filters') { state.search = ''; state.projectFilter = 'all'; state.severityFilter = 'all'; render(); return; }
    if (name === 'investigate') { state.findingStatus[record().id] = 'investigating'; addEvent(record().id, 'started investigating this finding'); render(); announce('Finding marked as investigating.'); return; }
    if (name === 'reopen' || name === 'undo') { state.tab = 'open'; state.findingStatus[record().id] = 'open'; addEvent(record().id, 'reopened this finding'); state.toast = ''; if (name === 'undo') go('finding'); else render(); announce('Finding reopened.'); return; }
    if (name === 'toggle-email') { state.emailEnabled = !state.emailEnabled; render(); announce(state.emailEnabled ? 'Sample email alerts enabled.' : 'Sample email alerts disabled.'); return; }
    if (name === 'test-email' && state.emailEnabled) { state.deliveries.unshift({ at: Date.now() }); render(); announce('Simulated test delivery recorded. No real email was sent.'); }
  }

  async function importFile(file) {
    if (!file) return;
    state.error = '';
    if (file.size > 2 * 1024 * 1024) { state.error = 'This file is over 2 MB. Split the inventory into smaller projects and try again.'; render(); return; }
    try {
      const content = await file.text();
      let list = [];
      if (/\.ya?ml$/i.test(file.name)) {
        const lines = content.split('\n');
        for (const line of lines) {
          const match = line.match(/^\s{2}['"]?((?:@[^/\s]+\/)?[^@\s:'"]+)@(\d+\.\d+\.\d+(?:-[\w.-]+)?)(?:\([^\n]+\))?['"]?:\s*$/);
          if (match) list.push({ name: match[1], version: match[2], ecosystem: 'npm' });
        }
      } else {
        const data = JSON.parse(content);
        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data.packages)) list = data.packages;
        else if ([2, 3].includes(Number(data.lockfileVersion)) && data.packages) {
          list = Object.entries(data.packages).filter(([path, value]) => path.includes('node_modules/') && value && !value.link).map(([path, value]) => ({ name: value.name || path.slice(path.lastIndexOf('node_modules/') + 13), version: value.version, ecosystem: 'npm' }));
        } else if (data.dependencies) {
          list = Object.entries(data.dependencies).map(([name, version]) => ({ name, version, ecosystem: 'npm' }));
        }
      }
      const exact = list.filter((item) => item && typeof item.name === 'string' && typeof item.version === 'string' && /^\d+(?:\.\d+)+(?:[-+._a-z0-9]*)$/i.test(item.version));
      importedPackages = [...new Map(exact.map((item) => [`${item.name}@${item.version}`, { name: item.name, version: item.version, ecosystem: item.ecosystem || 'npm' }])).values()];
      if (!importedPackages.length) throw new Error('No exact package versions were found. Use an npm/pnpm lockfile or pinned inventory JSON.');
      if (importedPackages.length > 2000) throw new Error('This inventory contains over 2,000 package versions. Split it into smaller projects.');
      state.imported = true; state.sample = false; state.fileName = file.name; state.inventory = importedPackages;
      if (exact.length < list.length) state.error = `${list.length - exact.length} entries without exact versions were skipped. Review the remaining versions before continuing.`;
      render(); announce('Inventory read locally. Review the package versions before continuing.');
    } catch (error) { state.imported = false; state.error = error instanceof SyntaxError ? 'This file is not valid inventory JSON. Check the file or try the sample inventory.' : error.message || 'This inventory could not be read. Try a supported lockfile.'; render(); }
  }

  function bind(view) {
    document.querySelectorAll('[data-action]').forEach((element) => element.addEventListener('click', () => action(element.dataset.action)));
    document.querySelectorAll('[data-finding]').forEach((element) => element.addEventListener('click', () => { state.selected = element.dataset.finding; state.toast = ''; state.evidence = ''; save(); if (location.hash === '#finding') render(); }));
    document.querySelectorAll('[data-row]').forEach((element) => element.addEventListener('click', (event) => { if (event.target.closest('a')) return; state.selected = element.dataset.row; state.toast = ''; state.evidence = ''; go('finding'); }));
    document.querySelectorAll('[data-project]').forEach((element) => element.addEventListener('click', () => { state.projectFilter = element.dataset.project; state.tab = 'open'; save(); }));
    document.getElementById('project-form')?.addEventListener('submit', (event) => { event.preventDefault(); const input = document.getElementById('project-name'); const name = input.value.trim(); if (!name) { input.setCustomValidity('Enter a project name.'); input.reportValidity(); return; } input.setCustomValidity(''); state.projectName = name; state.environment = document.getElementById('environment').value; save(); go('import'); });
    document.getElementById('inventory-file')?.addEventListener('change', (event) => importFile(event.target.files[0]));
    const drop = document.getElementById('drop-zone');
    drop?.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop?.addEventListener('drop', (event) => { event.preventDefault(); importFile(event.dataTransfer.files[0]); });
    for (const [id, key] of [['project-filter', 'projectFilter'], ['severity-filter', 'severityFilter']]) document.getElementById(id)?.addEventListener('change', (event) => { state[key] = event.target.value; render(); });
    document.getElementById('finding-search')?.addEventListener('input', (event) => { const position = event.target.selectionStart; state.search = event.target.value; render(); const input = document.getElementById('finding-search'); input.focus(); try { input.setSelectionRange(position, position); } catch { /* Search inputs do not support selection on every browser. */ } });
    document.getElementById('resolution-evidence')?.addEventListener('input', (event) => { state.evidence = event.target.value; document.getElementById('evidence-count').textContent = `At least 10 characters · ${state.evidence.length} entered`; save(); });
    document.getElementById('resolution-form')?.addEventListener('submit', (event) => { event.preventDefault(); const evidence = document.getElementById('resolution-evidence').value.trim(); if (evidence.length < 10) { state.error = 'Add at least 10 characters describing how the fix was verified.'; state.evidence = evidence; render(); return; } state.findingStatus[record().id] = 'resolved'; addEvent(record().id, 'recorded a resolution · user attested', evidence); state.evidence = ''; state.toast = `${record().id} resolved with your evidence`; state.tab = 'resolved'; state.search = ''; state.projectFilter = 'all'; state.severityFilter = 'all'; save(); go('resolved'); announce('Resolution recorded as user-attested evidence.'); });
  }

  window.addEventListener('hashchange', () => { state.error = ''; render(); window.scrollTo(0, 0); });
  render();
})();
