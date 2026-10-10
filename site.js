(() => {
  const stage = document.querySelector('.product-stage');
  const panel = document.getElementById('demo-panel');
  const demoButtons = document.querySelectorAll('[data-demo]');
  const motionButton = document.getElementById('demo-motion');
  const demos = {
    terminal: {
      title: 'TermLink / UART0', label: '实时终端',
      html: '<div class="demo-terminal"><div class="terminal-caption">UART0 · 115200 baud · 示例日志</div><div class="log-line">[00:00.000] 串口会话已连接</div><div class="log-line">[00:00.182] 正在接收设备启动输出…</div><div class="log-line accent">[00:00.346] 日志记录已启用</div><div class="log-line">[00:00.521] 等待下一行输出<span class="cursor-mark">▍</span></div></div><div class="panel-label">当前资源</div><div class="resource-row"><div class="resource-card"><strong>本地串口</strong><span>/dev/cu.usbserial · 115200</span></div><div class="resource-card"><strong>会话状态</strong><span>已连接 · 可搜索</span></div><div class="resource-card"><strong>日志</strong><span>可在设置中启用记录</span></div></div>'
    },
    power: {
      title: 'PMT / 电源控制', label: '通道状态',
      html: '<div class="power-overview"><div><p class="panel-label">PMT / 通道 01</p><h4>让供电状态，跟着设备走。</h4><p>先确认电源轨，再继续调试。</p></div><div class="power-symbol" aria-hidden="true">⏻</div></div><div class="resource-row"><div class="resource-card"><span>5V 电源轨</span><strong><i class="state-dot off"></i>已关闭</strong></div><div class="resource-card"><span>12V 电源轨</span><strong><i class="state-dot"></i>已开启</strong></div><div class="resource-card"><span>设备关联</span><strong>T32Pro · 实验板 A</strong></div></div><p class="demo-note">状态示意 · 实际电源轨和通道由设备绑定决定。</p>'
    },
    flashing: {
      title: 'Burn Tool / 分区表', label: '烧录准备',
      html: '<div class="partition-table"><table><thead><tr><th>分区</th><th>镜像</th><th>大小</th><th>状态</th></tr></thead><tbody><tr><td>uboot</td><td>u-boot.bin</td><td>1 MiB</td><td>已选择</td></tr><tr><td>kernel</td><td>uImage</td><td>8 MiB</td><td>已选择</td></tr><tr><td>rootfs</td><td>rootfs.squashfs</td><td>24 MiB</td><td>已选择</td></tr></tbody></table></div><div class="burn-progress"><div><span id="burn-status">镜像映射示例 · 尚未执行</span><b id="burn-value">0%</b></div><progress id="burn-meter" value="0" max="100" aria-label="烧录流程示意进度"></progress></div><div class="demo-bottom"><span class="demo-note">不连接硬件，仅播放流程示意。</span><button class="demo-run" id="demo-run">播放流程示意 →</button></div>'
    }
  };
  let burnTimer;
  let burnValue = 0;
  function setDemo(name) {
    clearInterval(burnTimer);
    const current = demos[name] ? name : 'terminal';
    if (panel) panel.innerHTML = '<div class="panel-heading"><h3>' + demos[current].title + '</h3><span class="panel-label">' + demos[current].label + '</span></div>' + demos[current].html;
    demoButtons.forEach((button) => {
      const active = button.dataset.demo === current;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (stage) stage.dataset.demo = current;
    const runButton = document.getElementById('demo-run');
    if (runButton) runButton.addEventListener('click', () => {
      clearInterval(burnTimer);
      burnValue = 0;
      runButton.disabled = true;
      runButton.textContent = '正在演示…';
      burnTimer = setInterval(() => {
        if (document.body.classList.contains('motion-paused') || document.hidden) return;
        burnValue = Math.min(100, burnValue + 2);
        document.getElementById('burn-meter').value = burnValue;
        document.getElementById('burn-value').textContent = burnValue + '%';
        document.getElementById('burn-status').textContent = burnValue < 24 ? '01 核对配置（示意）' : burnValue < 85 ? '02 写入镜像（示意）' : '03 检查结果（示意）';
        if (burnValue === 100) {
          clearInterval(burnTimer);
          document.getElementById('burn-status').textContent = '流程示意结束 · 未执行硬件操作';
          runButton.disabled = false;
          runButton.textContent = '重新播放 →';
        }
      }, 90);
    });
  }
  demoButtons.forEach((button) => button.addEventListener('click', () => setDemo(button.dataset.demo)));
  if (motionButton) motionButton.addEventListener('click', () => {
    const paused = document.body.classList.toggle('motion-paused');
    motionButton.textContent = paused ? '▶' : 'Ⅱ';
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? '播放演示动画' : '暂停演示动画');
  });
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('motion-paused');
    motionButton.textContent = '▶';
    motionButton.setAttribute('aria-pressed', 'true');
    motionButton.setAttribute('aria-label', '播放演示动画');
  }
  setDemo('terminal');

  document.querySelectorAll('.filter-bar button').forEach((button) => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    document.querySelectorAll('.filter-bar button').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.case-card').forEach((card) => { card.hidden = filter !== 'all' && card.dataset.category !== filter; });
  }));

  const menu = document.querySelector('.menu-toggle');
  const header = document.querySelector('.site-header');
  if (menu && header) menu.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!expanded));
    header.classList.toggle('menu-expanded', !expanded);
  });
  document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
    if (menu) menu.setAttribute('aria-expanded', 'false');
    if (header) header.classList.remove('menu-expanded');
  }));

  const courses = [
    ['你的第一个设备工作区', ['安装与版本确认', '添加设备并选择板型', '绑定串口和电源通道', '在桌面应用内完成第一次检查']],
    ['终端、日志与共享会话', ['创建本地串口会话', '搜索和保存启动日志', '理解共享串口与占用状态', '附加远端 TermLink']],
    ['从分区表到烧录计划', ['确认板型、供电和镜像', '读取并检查分区表', '理解开始烧录后的自动预检', '完成后核对状态并终止烧录']]
  ];
  const dialog = document.getElementById('course-dialog');
  const courseBody = document.getElementById('course-body');
  const closeDialog = dialog && dialog.querySelector('.dialog-close');
  document.querySelectorAll('[data-course]').forEach((button) => button.addEventListener('click', () => {
    const course = courses[Number(button.dataset.course)];
    if (!course || !dialog || !courseBody) return;
    courseBody.innerHTML = '<h2 id="course-title">' + course[0] + '</h2><p>本课程视频尚未录制。你可以先查看学习目标，并阅读对应的图文教程。</p><ol>' + course[1].map((item) => '<li>' + item + '</li>').join('') + '</ol><a class="text-link" href="docs.html?guide=' + (button.dataset.course === '0' ? 'quickstart' : button.dataset.course === '1' ? 'terminal' : 'flashing') + '">阅读对应教程 ↗</a>';
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }));
  if (closeDialog) closeDialog.addEventListener('click', () => dialog.close());
  if (dialog) dialog.addEventListener('click', (event) => { const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close(); });

  const grid = document.getElementById('download-grid');
  const summary = document.getElementById('release-summary');
  const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  if (grid) fetch('release.json', { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error('manifest'); return response.json(); }).then((release) => {
    if (summary) summary.textContent = 'v' + release.version + ' · ' + release.date + ' · 已核验的安装包';
    const platforms = [
      {id:'windows', title:'Windows', icon:'⊞', description:'x64 · 安装版或解压即用的便携版'},
      {id:'macos', title:'macOS', icon:'⌘', description:'Apple 芯片与 Intel · DMG 安装包'},
      {id:'linux', title:'Linux', icon:'>_', description:'x64 · Debian / Ubuntu · DEB 安装包'}
    ];
    const labels = {'windows-setup':'安装版 .exe','windows-portable':'便携版 .zip','macos-arm64':'Apple 芯片','macos-x64':'Intel 芯片','linux-deb':'下载 .deb'};
    grid.innerHTML = platforms.map((platform) => '<article class="download-platform"><div class="os-icon" aria-hidden="true">' + platform.icon + '</div><h3>' + platform.title + '</h3><p>' + platform.description + '</p><div class="download-options">' + release.packages.filter((item) => item.platform === platform.id).map((item) => '<a href="' + esc(item.url) + '" download aria-label="下载 '+esc(item.label)+'">' + labels[item.id] + ' ↓<small>' + (item.size / 1024 / 1024).toFixed(1) + ' MB</small></a>').join('') + '</div></article>').join('');
  }).catch(() => {
    if (summary) summary.textContent = '发布清单暂时不可用';
    grid.innerHTML = '<div class="download-platform"><h3>打开发布记录</h3><p>请从 GitHub Release 查看当前安装包。</p><a class="download-options" href="https://github.com/Tschome/workbench/releases" target="_blank" rel="noreferrer">查看发布记录 ↗</a></div>';
  });
})();
