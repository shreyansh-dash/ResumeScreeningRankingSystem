const API = window.location.port === '8000' ? '' : 'http://127.0.0.1:8000';
let page = 1,
  total = 0,
  charts = [],
  comparisonChart;

const $ = s => document.querySelector(s);
const escapeHTML = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

async function api(path, options) {
  const r = await fetch(API + path, options);
  if (!r.ok) throw new Error((await r.json().catch(() => ({ detail: r.statusText }))).detail);
  return r.json();
}

function filterParams(pageSize = 20) {
  const p = new URLSearchParams({
    page,
    page_size: pageSize,
    sort: 'AI_Score',
    direction: 'desc'
  });

  const range = id => {
    const v = $(id).value;
    if (v) {
      const [a, b] = v.split('-');
      p.set(
        id === '#experience' ? 'min_experience' : 'min_salary',
        a
      );
      p.set(
        id === '#experience' ? 'max_experience' : 'max_salary',
        b
      );
    }
  };

  if ($('#search').value) p.set('search', $('#search').value);
  if ($('#role').value) p.set('role', $('#role').value);
  if ($('#decision').value) p.set('decision', $('#decision').value);
  if ($('#certification').value) p.set('certification', $('#certification').value);

  range('#experience');
  range('#salaryFilter');

  const s = $('#score').value;
  if (s === '80') p.set('min_score', '80');
  if (s === '50') {
    p.set('min_score', '50');
    p.set('max_score', '79');
  }
  if (s === '0') p.set('max_score', '49');

  return p;
}

async function loadRoles() {
  for (const role of await api('/roles')) {
    $('#role').add(new Option(role, role));
    $('#targetRole').add(new Option(role, role));
  }
}

async function loadCandidates() {
  const d = await api('/candidates?' + filterParams());
  total = d.total;
  $('#totalCandidates').textContent = total;
  $('#pageInfo').textContent = `Page ${page} of ${Math.max(1, Math.ceil(total / 20))}`;
  $('#rows').innerHTML = d.items.map(x => `
    <tr>
      <td>${x.Resume_ID}</td>
      <td>${escapeHTML(x.Name)}</td>
      <td>${escapeHTML(x.Job_Role)}</td>
      <td>${x.Experience_Years} years</td>
      <td>${escapeHTML(x.Education)}</td>
      <td class="skill">${escapeHTML(x.Skills || '—')}</td>
      <td>${escapeHTML(x.Certifications || '—')}</td>
      <td>${x.Projects_Count}</td>
      <td>$${Number(x.Salary_Expectation).toLocaleString()}</td>
      <td class="score">${x.AI_Score}</td>
      <td class="${x.Recruiter_Decision === 'Hire' ? 'hire' : 'reject'}">${x.Recruiter_Decision}</td>
    </tr>
  `).join('') || '<tr><td colspan="11">No candidates match the selected filters.</td></tr>';

  $('#previous').disabled = page === 1;
  $('#next').disabled = page * 20 >= total;
}

function renderFallback(node, labels, datasets) {
  let maximum = 1;
  datasets.forEach(set => {
    set.data.forEach(value => {
      maximum = Math.max(maximum, Number(value) || 0);
    });
  });

  const chart = document.createElement('div');
  chart.className = 'fallback-chart';
  chart.innerHTML = `
    <div class="fallback-legend">
      ${datasets.map(set => `
        <span>
          <i style="background:${set.backgroundColor || set.borderColor}"></i>
          ${escapeHTML(set.label)}
        </span>
      `).join('')}
    </div>
    <div class="fallback-bars">
      ${labels.map((label, index) => `
        <div class="fallback-group">
          <div class="fallback-columns">
            ${datasets.map(set => `
              <i title="${escapeHTML(set.label)}: ${set.data[index]}" 
                 style="height:${Math.max(3, (Number(set.data[index]) || 0) / maximum * 145)}px;
                        background:${set.backgroundColor || set.borderColor}">
              </i>
            `).join('')}
          </div>
          <small>${escapeHTML(label)}</small>
        </div>
      `).join('')}
    </div>
  `;
  node.replaceWith(chart);
}

function chart(id, type, labels, datasets) {
  renderFallback($(id), labels, datasets);
}

async function loadAnalytics() {
  const d = await api('/analytics?' + filterParams());

  charts.forEach(c => c.destroy());
  charts = [];

  const labels = d.by_role.map(x => x.Job_Role);

  chart('#hireRatioChart', 'bar', labels, [
    {
      label: 'Hired',
      data: d.by_role.map(x => x.hires),
      backgroundColor: '#28c87b'
    },
    {
      label: 'Rejected',
      data: d.by_role.map(x => x.candidates - x.hires),
      backgroundColor: '#e74c3c'
    }
  ]);

  chart('#avgSalaryChart', 'bar', d.salaries.map(x => x.Job_Role), [
    {
      label: 'Average salary ($)',
      data: d.salaries.map(x => x.average_salary),
      backgroundColor: '#3498db'
    }
  ]);

  const top = d.skills.slice(0, 8);
  chart('#topSkillsChart', 'bar', top.map(x => x.Skill), [
    {
      label: 'Hired candidates',
      data: top.map(x => x.frequency),
      backgroundColor: '#087dff'
    }
  ]);

  chart('#scoreDecisionChart', 'bar', d.score_decisions.map(x => x.score_band), [
    {
      label: 'Hire',
      data: d.score_decisions.map(x => x.hires),
      backgroundColor: '#28c87b'
    },
    {
      label: 'Reject',
      data: d.score_decisions.map(x => x.rejects),
      backgroundColor: '#f39c12'
    }
  ]);

  chart('#experienceChart', 'line', d.experience.map(x => x.Experience_Years), [
    {
      label: 'Candidates by experience',
      data: d.experience.map(x => x.candidates),
      borderColor: '#3498db',
      backgroundColor: '#3498db33',
      fill: true,
      tension: .25
    }
  ]);
}

function showResult(d) {
  const tags = (list, missing = false) => list.slice(0, 10).map(x => `
    <span class="tag ${missing ? 'missing' : ''}">${escapeHTML(x)}</span>
  `).join('') || '—';

  $('#result').className = 'card result';
  $('#result').innerHTML = `
    <h3>Analysis Results</h3>
    <p><b>${escapeHTML(d.profile.name)}</b> · ${escapeHTML(d.decision)}</p>
    <div class="result-score">${d.score}/100</div>
    <p>Rank <b>#${d.rank}</b> against ${d.benchmark_size} hired ${escapeHTML(d.target_role)} candidates.</p>
    <div class="result-grid">
      <div>Skill match<strong>${d.comparison.skill_match}%</strong></div>
      <div>Experience<strong>${d.profile.experience_years} / ${d.comparison.hired_experience} yrs</strong></div>
      <div>Projects<strong>${d.profile.projects_count} / ${d.comparison.hired_projects}</strong></div>
      <div>Salary<strong>${d.comparison.candidate_salary ? '$' + Number(d.comparison.candidate_salary).toLocaleString() : 'Not provided'}</strong></div>
    </div>
    <p><b>Matched Skills</b></p>
    <div class="tags">${tags(d.matched_skills)}</div>
    <p><b>Skill Gaps</b></p>
    <div class="tags">${tags(d.missing_skills, true)}</div>
    <p><b>Recommendation:</b> ${escapeHTML(d.feedback)}</p>
    <div id="comparisonChart" class="chart-loading">Preparing comparison…</div>
  `;

  renderFallback(
    $('#comparisonChart'),
    ['Skills', 'Experience', 'Projects'],
    [
      {
        label: 'Resume',
        data: [
          d.comparison.skill_match,
          d.profile.experience_years / Math.max(1, d.comparison.hired_experience) * 100,
          d.profile.projects_count / Math.max(1, d.comparison.hired_projects) * 100
        ],
        backgroundColor: '#3498db'
      },
      {
        label: 'Hired benchmark',
        data: [100, 100, 100],
        backgroundColor: '#b9c5cc'
      }
    ]
  );
}

async function exportCSV(all = false) {
  const p = filterParams(all ? 100 : 20);
  p.set('page', '1');

  let d = await api('/candidates?' + p),
    items = d.items;

  if (all) {
    for (let current = 2; items.length < d.total; current++) {
      p.set('page', current);
      items = items.concat((await api('/candidates?' + p)).items);
    }
  }

  const cols = [
    'Resume_ID',
    'Name',
    'Job_Role',
    'Experience_Years',
    'Education',
    'Skills',
    'Certifications',
    'Projects_Count',
    'Salary_Expectation',
    'AI_Score',
    'Recruiter_Decision'
  ];

  const csv = [
    cols.join(','),
    ...items.map(r => cols.map(k => JSON.stringify(r[k] ?? '')).join(',')).join('\n')
  ].join('\n');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = all ? 'all-candidates.csv' : 'filtered-candidates.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

$('#applyFilters').onclick = () => {
  page = 1;
  loadCandidates();
};

$('#previous').onclick = () => {
  page--;
  loadCandidates();
};

$('#next').onclick = () => {
  page++;
  loadCandidates();
};

$('#exportPage').onclick = () => exportCSV();

$('#exportFiltered').onclick = () => exportCSV();

$('#exportAll').onclick = () => exportCSV(true);

$('#resume').onchange = e => $('#fileName').textContent = e.target.files[0]?.name || 'Supported formats: PDF, DOCX';

$('#screenForm').onsubmit = async e => {
  e.preventDefault();
  const f = $('#resume').files[0];
  if (!f) return;

  const form = new FormData();
  form.append('file', f);
  form.append('target_role', $('#targetRole').value);
  if ($('#salary').value) form.append('expected_salary', $('#salary').value);

  const b = $('#submit');
  b.disabled = true;
  b.textContent = 'Analyzing…';

  try {
    showResult(await api('/screen-resume', { method: 'POST', body: form }));
  } catch (e) {
    $('#result').innerHTML = `<h3>Analysis Results</h3><p>Screening failed: ${escapeHTML(e.message)}</p>`;
  } finally {
    b.disabled = false;
    b.textContent = 'Analyze Resume';
  }
};

const showAnalyticsError = e =>
  document.querySelectorAll('.chart-loading').forEach(node =>
    node.textContent = `Chart data unavailable: ${e.message}`
  );

loadRoles().catch(e => console.error(e));
loadCandidates().catch(e =>
  $('#rows').innerHTML = `<tr><td colspan="11">Candidate data unavailable: ${escapeHTML(e.message)}</td></tr>`
);
loadAnalytics().catch(showAnalyticsError);

// Keep the analytics panels synchronized with the current filter selection.
$('#applyFilters').onclick = () => {
  page = 1;
  loadCandidates();
  loadAnalytics().catch(showAnalyticsError);
};
