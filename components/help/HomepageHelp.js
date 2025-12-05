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
    .link {
      color: #2980b9;
      text-decoration: underline;
    }
    .muted {
      color: #666;
      font-size: 13px;
    }
  </style>

  <div class="help-container">
    <div class="help-title">🏠 Home (Landing) Page</div>
    <p>Summary of the service, API info, and direct links to important endpoints.</p>

    <div class="help-section">
      <h5>1. API Information</h5>
      <ul>
        <li><span class="highlight">Title / Version / Description</span> — general service details from the API spec.</li>
        <li>License & contact are shown if provided by the server.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>2. Landing Links</h5>
      <p>Links are grouped and open in a new tab:</p>
      <ul>
        <li>API specification (<span class="highlight">/ogc-api/api</span>)</li>
        <li>Documentation (HTML views)</li>
        <li>Conformance (<span class="highlight">/ogc-api/conformance</span>)</li>
        <li>Processes (<span class="highlight">/ogc-api/processes</span>)</li>
        <li>Jobs (<span class="highlight">/ogc-api/jobs</span>)</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>3. Related Standards</h5>
      <ul>
        <li><a class="link" href="https://ogcapi.ogc.org/common" target="_blank">OGC API - Common</a></li>
        <li><a class="link" href="https://ogcapi.ogc.org/processes" target="_blank">OGC API - Processes</a></li>
      </ul>
    </div>

    <div class="help-section">
      <h5>4. FAQ — Why might information be missing?</h5>
      <ul>
        <li>Server didn't provide expected fields — check the API spec (<span class="highlight">/ogc-api/api</span>).</li>
        <li>Network/authentication issues — verify server URL and credentials.</li>
        <li>Browser cache or outdated data — try refreshing the page.</li>
      </ul>
    </div>
  </div>
`
