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
  </style>

  <div class="help-container">
    <div class="help-title">📋 Understanding the Jobs List</div>
    <p>This page shows all submitted jobs (executions) along with their details, status, and available actions.</p>

    <div class="help-section">
      <h5>1. Browsing Submitted Jobs</h5>
      <ul>
        <li>Each job is listed with its <span class="highlight">Job ID</span>, <span class="highlight">Process</span>, <span class="highlight">Status</span>, and <span class="highlight">Created Time</span>.</li>
        <li>You can quickly review all the jobs you have executed from this page.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>2. Viewing Job Details</h5>
      <ul>
        <li>Click on the <span class="highlight">View</span> action to open a job’s detailed information.</li>
        <li>Details include inputs, outputs, and status updates from the server.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>3. Managing Jobs</h5>
      <ul>
        <li>Use the <span class="highlight">Delete</span> option to remove a job permanently.</li>
        <li>The <span class="highlight">Actions menu</span> may contain extra links provided by the server (e.g., results, logs, or metadata).</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>4. Tips</h5>
      <ul>
        <li>Job <span class="highlight">status</span> updates when you refresh the page.</li>
        <li>Use <span class="highlight">View</span> to check progress or retrieve results.</li>
        <li>Deleting a job is <span class="highlight">permanent</span>, so only delete if you no longer need it.</li>
      </ul>
    </div>
  </div>
`