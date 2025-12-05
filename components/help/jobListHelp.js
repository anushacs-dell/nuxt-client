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
  </style>

  <div class="help-container">
    <div class="help-title">📋 Understanding the Jobs List</div>
    <p>This page lists all submitted jobs (process executions), their current status, and available actions.</p>

    <div class="help-section">
      <h5>1. Browsing Submitted Jobs</h5>
      <ul>
        <li>Each job shows its <span class="highlight">Job ID</span>, <span class="highlight">Process</span>, <span class="highlight">Status</span>, and <span class="highlight">Created Time</span>.</li>
        <li>Status values include:
          <ul>
            <li><span class="highlight">running</span> — process is executing.</li>
            <li><span class="highlight">successful</span> — process finished and results are available.</li>
            <li><span class="highlight">failed</span> — execution ended with an error.</li>
            <li><span class="highlight">dismissed</span> — job was cancelled or removed.</li>
          </ul>
        </li>
      </ul>
    </div>

    <div class="help-section">
      <h5>2. Viewing Job Details</h5>
      <ul>
        <li>Click <span class="highlight">View</span> to open detailed information about a job.</li>
        <li>Details include inputs, outputs, execution logs, and result links.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>3. Managing Jobs</h5>
      <ul>
        <li>Use <span class="highlight">Delete</span> to permanently remove a job from the list.</li>
        <li>The <span class="highlight">Actions menu</span> may contain extra links (e.g., direct results, logs, or metadata) provided by the server.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>4. Tips</h5>
      <ul>
        <li>Refresh the page to update the latest job statuses.</li>
        <li>Use <span class="highlight">View</span> to track progress and download results.</li>
        <li>Remember: deleting a job is <span class="highlight">permanent</span>.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>5. Related Standards</h5>
      <p>This feature follows the <a class="link" href="https://ogcapi.ogc.org/processes" target="_blank">OGC API - Processes (Jobs)</a> standard for managing asynchronous executions.</p>
    </div>

    <div class="help-section">
      <h5>6. FAQ — Common Issues</h5>
      <ul>
        <li><span class="highlight">Job stuck in running?</span> — Refresh or check server logs; the process may still be executing.</li>
        <li><span class="highlight">No results?</span> — Verify the job succeeded and outputs were requested with correct transmission mode.</li>
        <li><span class="highlight">Deleted job still visible?</span> — Try refreshing; if still present, deletion may not be supported by the server.</li>
      </ul>
    </div>
  </div>
`