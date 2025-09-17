    export default `
  <style>
    .help-container {
      font-family: 'Segoe UI', sans-serif;
      color: #333;
      line-height: 1.6;
      padding: 10px;
    }
    .help-title {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 10px;
      text-align: center;
    }
    .help-section {
      margin-bottom: 18px;
      padding: 10px;
      border-left: 4px solid #663e05;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .help-section h5 {
      font-size: 18px;
      margin-bottom: 6px;
      color: #2980b9;
    }
    .help-section p, .help-section ul {
      margin: 5px 0;
      padding-left: 15px;
    }
    .help-section ul li {
      list-style: none;
      margin: 5px 0;
      position: relative;
      padding-left: 20px;
    }
    .help-section ul li::before {
      content: "✔";
      color: #27ae60;
      position: absolute;
      left: 0;
    }
    .highlight {
      font-weight: bold;
      color: #e74c3c;
    }
    .muted {
      color: #666;
      font-size: 13px;
    }
  </style>

  <div class="help-container">
    <div class="help-title">🏠 Home (Landing) Page</div>
    <p>This page gives a quick summary of the OGC API service and direct links to important endpoints and documentation.</p>

    <div class="help-section">
      <h5>1. Service information (API Info)</h5>
      <ul>
        <li><span class="highlight">Title</span> — the service name shown at the top of the card.</li>
        <li><span class="highlight">Version</span> — service or API version.</li>
        <li><span class="highlight">Description</span> — short summary of what the service provides.</li>
        <li><span class="highlight">Contact</span> — contact name and email (click the mailto link to email the service contact).</li>
        <li><span class="highlight">License</span> — click the license link to view license details in a new tab.</li>
        <li class="muted">If any of these fields are missing, the server did not provide them in the API specification.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>2. Keywords & Service Contact</h5>
      <ul>
        <li><span class="highlight">Keywords</span> — quick tags describing the service (useful to understand capabilities).</li>
        <li><span class="highlight">Service Contact</span> — extended contact details (name, organization, email, address) used for support or reporting issues.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>3. Available Links (Landing Links)</h5>
      <p>The page lists links grouped by title. Each link opens in a new tab and points to an important resource or endpoint provided by the server:</p>
      <ul>
        <li>API specification (machine-readable): typically <span class="highlight">/ogc-api/api</span>.</li>
        <li>Human-friendly docs (HTML): often <span class="highlight">/ogc-api/api.html</span> or <span class="highlight">/ogc-api/index.html</span>.</li>
        <li>Conformance: <span class="highlight">/ogc-api/conformance</span> — shows which specifications the server implements.</li>
        <li>Processes: <span class="highlight">/ogc-api/processes</span> — list of available processes you can run.</li>
        <li>Jobs: <span class="highlight">/ogc-api/jobs</span> — list of submitted jobs (executions).</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>4. What each common link means</h5>
      <ul>
        <li><span class="highlight">/ogc-api/</span> — landing document (root) in JSON with server links.</li>
        <li><span class="highlight">/ogc-api/api</span> — the OpenAPI / service description (useful for integrations and understanding endpoints).</li>
        <li><span class="highlight">/ogc-api/conformance</span> — lists conformance classes (what features the server supports).</li>
        <li><span class="highlight">/ogc-api/processes</span> — browse available processes and jump to their execution forms.</li>
        <li><span class="highlight">/ogc-api/jobs</span> — view submitted jobs, their status, and available result links.</li>
        <li><span class="highlight">*.html</span> links — human-readable alternative pages (documentation or HTML views).</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>5. Loading & Refresh</h5>
      <p>The spinner appears while the page fetches landing links and the API spec from the server. If data does not appear:</p>
      <ul>
        <li>Check your network or server URL (the page requests <span class="highlight">/ogc-api</span> and <span class="highlight">/ogc-api/api</span>).</li>
        <li>Open the browser console for error details if links or API info are missing.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>6. Tips & Next steps</h5>
      <ul>
        <li>Click a link to open the resource in a new tab and explore endpoints or docs.</li>
        <li>Use the <span class="highlight">Processes</span> link to go to the process list and start executions.</li>
        <li>Use the <span class="highlight">Jobs</span> link to review submitted jobs and view results.</li>
        <li>If the contact or license is incorrect, contact your administrator or the service owner listed in the contact section.</li>
      </ul>
    </div>
  </div>
`
