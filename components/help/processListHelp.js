export default `
  <style>
    .help-container {
      font-family: inherit;
      color: #333;
      line-height: 1.6;
    }
    .help-title {
      font-size: 20px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 8px;
      text-align: center;
    }
    .help-intro {
      font-size: 14px;
      text-align: center;
      margin-bottom: 14px;
      color: #555;
    }
    .help-section {
      margin-bottom: 14px;
      padding: 10px 12px;
      border-left: 4px solid #663e05;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .help-section h5 {
      font-size: 16px;
      margin: 0 0 6px;
      color: #2980b9;
      font-weight: 600;
    }
    .help-section p {
      margin: 4px 0 6px;
      font-size: 14px;
    }
    .help-section ul {
      margin: 0;
      padding-left: 0;
      font-size: 14px;
    }
    .help-section ul li {
      list-style: none;
      margin: 6px 0;
      position: relative;
      padding-left: 18px;
    }
    .help-section ul li::before {
      content: "✔";
      color: #27ae60;
      position: absolute;
      left: 0;
      font-size: 12px;
    }
    .highlight {
      font-weight: 600;
      color: #e74c3c;
    }
    .link {
      color: #2980b9;
      text-decoration: underline;
    }
  </style>

  <div class="help-container">
    <div class="help-title">📋 Understanding the Process List</div>
    <div class="help-intro">
      This page displays all available processes that you can explore and execute using the OGC API service.
    </div>

    <div class="help-section">
      <h5>1. Browsing Available Processes</h5>
      <ul>
        <li>
          Each process is listed with its <span class="highlight">title</span> and
          <span class="highlight">description</span>.
        </li>
        <li>Quickly scan the list to identify the process you need.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>2. Viewing Process Details</h5>
      <ul>
        <li>Click a process card/row to open its detailed form.</li>
        <li>The form allows you to provide inputs and run the process.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>3. Searching and Filtering</h5>
      <ul>
        <li>
          Use the <span class="highlight">search box</span> to find a process by
          name or description.
        </li>
        <li>If filters are available, apply them to narrow down results.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>4. Next Steps</h5>
      <p>
        After selecting a process, you will be redirected to its execution page
        where you can:
      </p>
      <ul>
        <li>Provide required inputs.</li>
        <li>Preview or directly submit execution requests.</li>
        <li>Check outputs and monitor job results.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>5. Related Standards</h5>
      <p>
        Processes follow the
        <a class="link" href="https://ogcapi.ogc.org/processes" target="_blank">
          OGC API - Processes Standard
        </a>,
        defining how to discover and execute processes.
      </p>
    </div>

    <div class="help-section">
      <h5>6. FAQ — Common Issues</h5>
      <ul>
        <li>
          <span class="highlight">Process not loading?</span> — Check if the server
          endpoint <code>/ogc-api/processes</code> is reachable.
        </li>
        <li>
          <span class="highlight">Missing descriptions?</span> — The server may not
          provide metadata for every process.
        </li>
        <li>
          <span class="highlight">Errors on execution?</span> — Ensure all required
          inputs are provided in the correct format.
        </li>
      </ul>
    </div>
  </div>
`