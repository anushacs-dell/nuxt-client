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
    <div class="help-title">📋 Understanding the Process List</div>
    <p>This page displays all available processes that you can explore and execute using the OGC API service.</p>

    <div class="help-section">
      <h5>1. Browsing Available Processes</h5>
      <ul>
        <li>Each process is shown with its <span class="highlight">title</span> and <span class="highlight">description</span>.</li>
        <li>You can quickly scan the list to identify the process you need.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>2. Viewing Process Details</h5>
      <ul>
        <li>Click on a process card or row to open its detailed form.</li>
        <li>The detailed form allows you to provide inputs and run the process.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>3. Searching and Filtering</h5>
      <ul>
        <li>Use the <span class="highlight">search box</span> to find a process by name or description.</li>
        <li>If filters are available, use them to narrow down the list of processes.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>4. Next Steps</h5>
      <p>Once you select a process, you'll be redirected to its execution page where you can:</p>
      <ul>
        <li>Fill in required inputs.</li>
        <li>Preview and submit execution requests.</li>
        <li>View outputs and job results.</li>
      </ul>
    </div>
  </div>
`