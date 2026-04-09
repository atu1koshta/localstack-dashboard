const $ = (s) => document.querySelector(s);
const $content = $("#content");

window.copyText = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.createElement("div");
    toast.textContent = "Copied!";
    toast.style.cssText = "position:fixed;bottom:20px;right:20px;background:#238636;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;z-index:999";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  });
};

async function api(path, opts) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res.json();
}

// -- Routing --
const pages = { health: renderHealth, s3: renderS3, sqs: renderSQS, lambda: renderLambda, sns: renderSNS };
var currentPage = null;

function navigate(page) {
  if (typeof stopLambdaLogs === "function") stopLambdaLogs();
  currentPage = page;
  document.querySelectorAll(".sidebar a").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
  if (pages[page]) pages[page]();
}

window.refreshPage = () => {
  if (currentPage && pages[currentPage]) pages[currentPage]();
};

document.querySelectorAll(".sidebar a").forEach((a) =>
  a.addEventListener("click", (e) => { e.preventDefault(); navigate(a.dataset.page); })
);
window.addEventListener("hashchange", () => navigate(location.hash.slice(1) || "health"));
navigate(location.hash.slice(1) || "health");

// -- Health --
async function renderHealth() {
  $content.innerHTML = "<h2>Service Health</h2><div class='status-grid' id='health-grid'>Loading...</div>";
  const data = await api("/health");
  if (data.error) { $content.innerHTML = `<h2>Service Health</h2><div class="card"><p style="color:#f85149">${data.error}: ${data.detail || ""}</p></div>`; return; }
  const grid = $("#health-grid");
  grid.innerHTML = Object.entries(data.services)
    .sort(([, a], [, b]) => (a === "running" ? -1 : 1) - (b === "running" ? -1 : 1))
    .map(([name, status]) => `<div class="card"><span class="badge ${status}">${status}</span><h3 style="margin-top:6px">${name}</h3></div>`)
    .join("");
  grid.insertAdjacentHTML("beforebegin", `<p style="margin-bottom:12px;color:#8b949e">LocalStack ${data.version || ""} (${data.edition || ""})</p>`);
}

// -- S3 --
async function renderS3() {
  $content.innerHTML = `<h2>S3 Buckets</h2>
    <div class="toolbar"><input type="text" id="new-bucket" placeholder="New bucket name"><button class="btn primary" id="create-bucket">Create</button></div>
    <div id="s3-list">Loading...</div>`;
  $("#create-bucket").onclick = async () => {
    const name = $("#new-bucket").value.trim();
    if (!name) return;
    await api("/s3/buckets", { method: "POST", body: JSON.stringify({ name }) });
    renderS3();
  };
  const buckets = await api("/s3/buckets");
  const list = $("#s3-list");
  if (!buckets.length) { list.innerHTML = '<div class="empty">No buckets</div>'; return; }
  list.innerHTML = buckets.map((b) => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center">
      <div><h3>${b.Name}</h3><p>${new Date(b.CreationDate).toLocaleString()}</p></div>
      <div style="display:flex;gap:6px">
        <button class="btn" onclick="browseS3('${b.Name}','')">Browse</button>
        <button class="btn danger" onclick="deleteS3Bucket('${b.Name}')">Delete</button>
      </div>
    </div>`).join("");
}

window.browseS3 = async (bucket, prefix) => {
  $content.innerHTML = `<h2>s3://${bucket}/${prefix}</h2>
    <button class="btn" onclick="renderS3()" style="margin-bottom:12px">&larr; Back to buckets</button>
    <div id="s3-objects">Loading...</div>`;
  const data = await api(`/s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(prefix)}`);
  const el = $("#s3-objects");
  let html = "";
  for (const p of data.prefixes) {
    html += `<div class="card" style="cursor:pointer" onclick="browseS3('${bucket}','${p.Prefix}')"><h3>📁 ${p.Prefix}</h3></div>`;
  }
  for (const o of data.objects) {
    html += `<div class="card" style="display:flex;justify-content:space-between;align-items:center">
      <div><h3>${o.Key}</h3><p>${o.Size} bytes &middot; ${new Date(o.LastModified).toLocaleString()}</p></div>
      <button class="btn danger" onclick="deleteS3Object('${bucket}','${o.Key}')">Delete</button>
    </div>`;
  }
  el.innerHTML = html || '<div class="empty">Empty</div>';
};

window.deleteS3Bucket = async (name) => { if (confirm(`Delete bucket "${name}"?`)) { await api(`/s3/buckets/${name}`, { method: "DELETE" }); renderS3(); }};
window.deleteS3Object = async (bucket, key) => { if (confirm(`Delete "${key}"?`)) { await api(`/s3/buckets/${bucket}/objects/${key}`, { method: "DELETE" }); browseS3(bucket, ""); }};

// -- SQS --
async function renderSQS() {
  $content.innerHTML = "<h2>SQS Queues</h2><div id='sqs-list'>Loading...</div>";
  const queues = await api("/sqs/queues");
  const list = $("#sqs-list");
  if (!queues.length) { list.innerHTML = '<div class="empty">No queues</div>'; return; }
  list.innerHTML = queues.map((q) => {
    const name = q.url.split("/").pop();
    const visible = q.attributes?.ApproximateNumberOfMessages || "0";
    const inFlight = q.attributes?.ApproximateNumberOfMessagesNotVisible || "0";
    const total = parseInt(visible) + parseInt(inFlight);
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="cursor:pointer" onclick="showSQSDetail('${q.url}')"><h3>${name}</h3><p>${total} total &middot; ${visible} visible &middot; ${inFlight} in flight</p></div>
        <div style="display:flex;gap:6px">
          <button class="btn" onclick="showSQSDetail('${q.url}')">Inspect</button>
          <button class="btn danger" onclick="purgeSQS('${q.url}')">Purge</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

window.showSQSDetail = async (url) => {
  const name = url.split("/").pop();
  $content.innerHTML = `<h2>${name}</h2>
    <button class="btn" onclick="renderSQS()" style="margin-bottom:12px">&larr; Back</button>
    <div id="sqs-attrs" class="card">Loading attributes...</div>
    <div class="card"><h3>Send Message</h3>
      <textarea id="sqs-msg" placeholder='{"key":"value"}'></textarea>
      <button class="btn primary" style="margin-top:8px" onclick="sendSQSMsg('${url}')">Send</button>
    </div>
    <div class="card"><h3>Receive Messages</h3>
      <button class="btn" onclick="receiveSQSMsg('${url}')">Poll</button>
      <div id="sqs-messages" style="margin-top:8px"></div>
    </div>`;
  const attrs = await api(`/sqs/queues/${url}/attributes`);
  $("#sqs-attrs").innerHTML = `<h3>Queue Attributes</h3>
    <p>URL: <code>${url}</code> <span class="copy-btn" onclick="copyText('${url}')" title="Copy">&#x2398;</span></p>
    <p>ARN: <code>${attrs.QueueArn || "-"}</code> ${attrs.QueueArn ? `<span class="copy-btn" onclick="copyText('${attrs.QueueArn}')" title="Copy">&#x2398;</span>` : ""}</p>
    <p>Messages available: ${attrs.ApproximateNumberOfMessages || "0"}</p>
    <p>Messages in flight: ${attrs.ApproximateNumberOfMessagesNotVisible || "0"}</p>
    <p>Messages delayed: ${attrs.ApproximateNumberOfMessagesDelayed || "0"}</p>
    <p>Visibility timeout: ${attrs.VisibilityTimeout || "-"}s</p>
    <p>Delay: ${attrs.DelaySeconds || "0"}s</p>
    <p>Retention: ${attrs.MessageRetentionPeriod ? Math.round(attrs.MessageRetentionPeriod / 86400) + " days" : "-"}</p>
    <p>Max message size: ${attrs.MaximumMessageSize ? Math.round(attrs.MaximumMessageSize / 1024) + " KB" : "-"}</p>
    ${attrs.FifoQueue === "true" ? "<p>Type: FIFO</p>" : "<p>Type: Standard</p>"}
    <p>Created: ${attrs.CreatedTimestamp ? new Date(attrs.CreatedTimestamp * 1000).toLocaleString() : "-"}</p>`;
};

window.sendSQSMsg = async (url) => {
  const msg = $("#sqs-msg").value;
  const result = await api(`/sqs/queues/${url}/send`, { method: "POST", body: JSON.stringify({ message: msg }) });
  alert(result.messageId ? `Sent: ${result.messageId}` : `Error: ${result.error}`);
};

window.receiveSQSMsg = async (url) => {
  const el = $("#sqs-messages");
  el.innerHTML = "Polling...";
  const msgs = await api(`/sqs/queues/${url}/receive`, { method: "POST" });
  if (!msgs.length) { el.innerHTML = '<div class="empty">No messages</div>'; return; }
  el.innerHTML = msgs.map((m) => `<div class="card"><pre>${m.Body}</pre><div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><p style="font-size:11px">ID: ${m.MessageId}</p><button class="btn danger" onclick="deleteSQSMsg('${url}','${encodeURIComponent(m.ReceiptHandle)}')">Delete</button></div></div>`).join("");
};

window.deleteSQSMsg = async (url, receiptHandle) => {
  await api(`/sqs/queues/${url}/message/${decodeURIComponent(receiptHandle)}`, { method: "DELETE" });
  receiveSQSMsg(url);
};

window.purgeSQS = async (url) => { if (confirm("Purge all messages?")) { await api(`/sqs/queues/${url}/purge`, { method: "POST" }); renderSQS(); }};

// -- Lambda --
var lambdaLogInterval = null;
var lambdaLogLines = null;

function stopLambdaLogs() {
  if (lambdaLogInterval) { clearInterval(lambdaLogInterval); lambdaLogInterval = null; }
}

async function renderLambda() {
  stopLambdaLogs();
  $content.innerHTML = `<div style="display:flex;gap:16px;height:100%">
    <div style="flex:1;overflow-y:auto" id="lambda-left">
      <h2>Lambda Functions</h2>
      <div id="lambda-list">Loading...</div>
    </div>
    <div style="width:45%;display:none;flex-direction:column" id="lambda-right">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 id="logs-title" style="font-size:14px;color:#58a6ff"></h3>
        <div style="display:flex;gap:6px"><button class="btn" onclick="clearLambdaLogs()">Clear</button><button class="btn" onclick="closeLambdaLogs()">Close</button></div>
      </div>
      <div style="margin-bottom:8px"><input type="text" id="logs-filter" placeholder="Filter logs..." style="width:100%"></div>
      <div id="lambda-logs" style="flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px;overflow-y:auto;font-family:monospace;font-size:12px;line-height:1.6;color:#8b949e"></div>
    </div>
  </div>`;
  const fns = await api("/lambda/functions");
  const list = $("#lambda-list");
  if (!fns.length) { list.innerHTML = '<div class="empty">No functions</div>'; return; }
  list.innerHTML = fns.map((f) => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div style="cursor:pointer" onclick="openLambdaLogs('${f.name}')">
          <h3>${f.name}</h3>
          <p>${f.runtime} &middot; ${f.handler} &middot; ${f.memory}MB &middot; ${f.timeout}s timeout</p>
        </div>
        <button class="btn primary" onclick="showLambdaInvoke('${f.name}')">Invoke</button>
      </div>
      <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
        <code style="font-size:11px;color:#8b949e;background:#161b22;padding:2px 8px;border-radius:4px;word-break:break-all;flex:1">${f.invokeUrl}</code>
        <button class="btn" style="padding:2px 8px;font-size:11px" onclick="copyText('${f.invokeUrl}')">Copy</button>
      </div>
      <div id="lambda-detail-${f.name}" style="display:none;margin-top:8px;border-top:1px solid #30363d;padding-top:8px"></div>
    </div>`).join("");
}

window.openLambdaLogs = async (name) => {
  stopLambdaLogs();

  // collapse any open detail, then show this one
  document.querySelectorAll("[id^='lambda-detail-']").forEach((el) => { el.style.display = "none"; el.innerHTML = ""; });
  const detailEl = $(`#lambda-detail-${CSS.escape(name)}`);
  if (detailEl) {
    detailEl.style.display = "block";
    detailEl.innerHTML = "Loading...";
    const detail = await api(`/lambda/functions/${name}`);
    const c = detail.config || {};
    detailEl.innerHTML = `
      <p>Runtime: ${c.Runtime || "-"} &middot; Handler: ${c.Handler || "-"}</p>
      <p>Memory: ${c.MemorySize || "-"}MB &middot; Timeout: ${c.Timeout || "-"}s</p>
      <p>Last modified: ${c.LastModified ? new Date(c.LastModified).toLocaleString() : "-"}</p>
      ${c.Environment?.Variables ? `<details style="margin-top:6px"><summary style="cursor:pointer;color:#58a6ff">Environment variables</summary><pre style="margin-top:4px">${escapeHtml(JSON.stringify(c.Environment.Variables, null, 2))}</pre></details>` : ""}`;
  }

  // open logs panel
  const panel = $("#lambda-right");
  const logsEl = $("#lambda-logs");
  const filterInput = $("#logs-filter");
  panel.style.display = "flex";
  $("#logs-title").textContent = `Logs: ${name}`;
  filterInput.value = "";
  logsEl.innerHTML = '<span style="color:#484f58">Loading logs...</span>';

  let since = Date.now() - 3600000;
  let autoScroll = true;
  var logLines = lambdaLogLines = [];

  logsEl.addEventListener("scroll", () => {
    const atBottom = logsEl.scrollHeight - logsEl.scrollTop - logsEl.clientHeight < 40;
    autoScroll = atBottom;
  });

  filterInput.oninput = () => renderLogLines(logsEl, logLines, filterInput.value, autoScroll);

  const fetchLogs = async () => {
    const data = await api(`/lambda/functions/${name}/logs?since=${since}`);
    if (data.events && data.events.length) {
      for (const e of data.events) {
        logLines.push({ ts: e.timestamp, msg: e.message });
      }
      since = data.events[data.events.length - 1].timestamp + 1;
      renderLogLines(logsEl, logLines, filterInput.value, autoScroll);
    } else if (logLines.length === 0) {
      logsEl.innerHTML = '<span style="color:#484f58">No logs yet. Waiting...</span>';
    }
  };

  fetchLogs();
  lambdaLogInterval = setInterval(fetchLogs, 3000);
};

function renderLogLines(logsEl, logLines, filter, autoScroll) {
  const keyword = filter.trim().toLowerCase();
  const filtered = keyword ? logLines.filter((l) => l.msg.toLowerCase().includes(keyword)) : logLines;
  if (!filtered.length) {
    logsEl.innerHTML = keyword
      ? '<span style="color:#484f58">No matching logs</span>'
      : '<span style="color:#484f58">No logs yet. Waiting...</span>';
    return;
  }
  logsEl.innerHTML = filtered.map((l) => {
    const ts = new Date(l.ts).toLocaleTimeString();
    let msg = escapeHtml(l.msg);
    if (keyword) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      msg = msg.replace(new RegExp(`(${escaped})`, "gi"), '<mark style="background:#a68307;color:#fff;padding:0 2px;border-radius:2px">$1</mark>');
    }
    return `<div><span style="color:#484f58">${ts}</span> ${msg}</div>`;
  }).join("");
  if (autoScroll) logsEl.scrollTop = logsEl.scrollHeight;
}

window.clearLambdaLogs = () => {
  if (lambdaLogLines) lambdaLogLines.length = 0;
  const logsEl = $("#lambda-logs");
  if (logsEl) logsEl.innerHTML = '<span style="color:#484f58">Logs cleared. Waiting for new logs...</span>';
};

window.closeLambdaLogs = () => {
  stopLambdaLogs();
  $("#lambda-right").style.display = "none";
};

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

window.showLambdaInvoke = async (name) => {
  stopLambdaLogs();
  $content.innerHTML = `<h2>${name}</h2>
    <button class="btn" onclick="renderLambda()" style="margin-bottom:12px">&larr; Back</button>
    <div id="fn-detail">Loading config...</div>
    <div class="card" style="margin-top:12px"><h3>Invoke</h3>
      <textarea id="lambda-payload" placeholder='{"key":"value"}'>{}</textarea>
      <button class="btn primary" style="margin-top:8px" id="invoke-btn">Invoke</button>
      <div id="invoke-result" style="margin-top:8px"></div>
    </div>`;
  const detail = await api(`/lambda/functions/${name}`);
  $("#fn-detail").innerHTML = `<div class="card"><h3>Configuration</h3><pre>${JSON.stringify(detail.config, null, 2)}</pre></div>`;
  $("#invoke-btn").onclick = async () => {
    const el = $("#invoke-result");
    el.innerHTML = "Invoking...";
    try {
      const payload = JSON.parse($("#lambda-payload").value);
      const result = await api(`/lambda/functions/${name}/invoke`, { method: "POST", body: JSON.stringify({ payload }) });
      el.innerHTML = `<div class="card"><h3>Status: ${result.statusCode}</h3>${result.error ? `<p style="color:#f85149">Error: ${result.error}</p>` : ""}<pre>${JSON.stringify(result.payload, null, 2)}</pre></div>`;
    } catch (e) {
      el.innerHTML = `<p style="color:#f85149">${e.message}</p>`;
    }
  };
};

// -- SNS --
async function renderSNS() {
  $content.innerHTML = `<h2>SNS Topics</h2>
    <div class="toolbar"><input type="text" id="new-topic" placeholder="New topic name"><button class="btn primary" id="create-topic">Create</button></div>
    <div id="sns-list">Loading...</div>`;
  $("#create-topic").onclick = async () => {
    const topicName = $("#new-topic").value.trim();
    if (!topicName) return;
    await api("/sns/topics", { method: "POST", body: JSON.stringify({ name: topicName }) });
    renderSNS();
  };
  const topics = await api("/sns/topics");
  const list = $("#sns-list");
  if (!topics.length) { list.innerHTML = '<div class="empty">No topics</div>'; return; }
  list.innerHTML = topics.map((t) => {
    const topicName = t.arn.split(":").pop();
    const subs = t.attributes?.SubscriptionsConfirmed || "0";
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="cursor:pointer" onclick="showSNSDetail('${t.arn}')">
          <h3>${topicName}</h3>
          <p>${subs} subscriptions</p>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn" onclick="showSNSDetail('${t.arn}')">Inspect</button>
          <button class="btn danger" onclick="deleteSNSTopic('${t.arn}')">Delete</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

window.showSNSDetail = async (arn) => {
  const name = arn.split(":").pop();
  $content.innerHTML = `<h2>${name}</h2>
    <button class="btn" onclick="renderSNS()" style="margin-bottom:12px">&larr; Back</button>
    <div id="sns-attrs" class="card">Loading...</div>
    <div class="card"><h3>Publish Message</h3>
      <input type="text" id="sns-subject" placeholder="Subject (optional)" style="width:100%;margin-bottom:8px">
      <textarea id="sns-msg" placeholder="Message body"></textarea>
      <button class="btn primary" style="margin-top:8px" onclick="publishSNS('${arn}')">Publish</button>
    </div>
    <div class="card"><h3>Add Subscription</h3>
      <div class="toolbar" style="margin-bottom:0">
        <select id="sns-protocol" style="background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:6px 10px;border-radius:6px;font-size:13px">
          <option value="sqs">SQS</option>
          <option value="http">HTTP</option>
          <option value="https">HTTPS</option>
          <option value="email">Email</option>
          <option value="lambda">Lambda</option>
        </select>
        <input type="text" id="sns-endpoint" placeholder="Endpoint (ARN or URL)" style="flex:1">
        <button class="btn primary" onclick="subscribeSNS('${arn}')">Subscribe</button>
      </div>
    </div>
    <div id="sns-subs">Loading subscriptions...</div>`;

  const [topics, subs] = await Promise.all([
    api("/sns/topics"),
    api(`/sns/topics/${arn}/subscriptions`),
  ]);
  const topic = topics.find((t) => t.arn === arn);
  const attrs = topic?.attributes || {};
  $("#sns-attrs").innerHTML = `<h3>Topic Attributes</h3>
    <p>ARN: <code>${arn}</code> <span class="copy-btn" onclick="copyText('${arn}')" title="Copy">&#x2398;</span></p>
    <p>Subscriptions confirmed: ${attrs.SubscriptionsConfirmed || "0"}</p>
    <p>Subscriptions pending: ${attrs.SubscriptionsPending || "0"}</p>
    <p>Subscriptions deleted: ${attrs.SubscriptionsDeleted || "0"}</p>`;

  const subsEl = $("#sns-subs");
  if (!subs.length) { subsEl.innerHTML = '<div class="empty">No subscriptions</div>'; return; }
  subsEl.innerHTML = `<div class="card"><h3>Subscriptions</h3>` + subs.map((s) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #21262d">
      <div><p>${s.Protocol} &rarr; <code>${s.Endpoint}</code></p><p style="font-size:11px;color:#484f58">${s.SubscriptionArn}</p></div>
      ${s.SubscriptionArn !== "PendingConfirmation" ? `<button class="btn danger" onclick="unsubscribeSNS('${arn}','${s.SubscriptionArn}')">Remove</button>` : '<span class="badge available">Pending</span>'}
    </div>`
  ).join("") + `</div>`;
};

window.publishSNS = async (arn) => {
  const msg = $("#sns-msg").value;
  const subject = $("#sns-subject").value;
  if (!msg) return;
  const result = await api(`/sns/topics/${arn}/publish`, { method: "POST", body: JSON.stringify({ message: msg, subject }) });
  alert(result.messageId ? `Published: ${result.messageId}` : `Error: ${result.error}`);
};

window.subscribeSNS = async (arn) => {
  const protocol = $("#sns-protocol").value;
  const endpoint = $("#sns-endpoint").value.trim();
  if (!endpoint) return;
  const result = await api(`/sns/topics/${arn}/subscribe`, { method: "POST", body: JSON.stringify({ protocol, endpoint }) });
  if (result.error) { alert(`Error: ${result.error}`); return; }
  showSNSDetail(arn);
};

window.unsubscribeSNS = async (arn, subArn) => {
  if (!confirm("Remove this subscription?")) return;
  await api(`/sns/subscriptions/${subArn}`, { method: "DELETE" });
  showSNSDetail(arn);
};

window.deleteSNSTopic = async (arn) => {
  if (confirm(`Delete topic "${arn.split(":").pop()}"?`)) {
    await api(`/sns/topics/${arn}`, { method: "DELETE" });
    renderSNS();
  }
};

