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
    <div class="help-title">🚀 How to Execute a Process</div>
    <p>Short guide to fill inputs, preview requests, and submit executions.</p>

    <div class="help-section">
      <h5>1. Filling Inputs</h5>
      <ul>
        <li>Provide values for required inputs. Hover tooltips for hints.</li>
        <li>Complex inputs accept URL (href) or inline data — choose the right transmission mode.</li>
        <li>Bounding boxes must be <span class="highlight">minX, minY, maxX, maxY</span>.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>2. Preview vs Submit</h5>
      <ul>
        <li><span class="highlight">Preview</span> — builds and shows the exact request (no execution).</li>
        <li><span class="highlight">Submit</span> — sends the request and starts processing; you’ll be redirected to Job status.</li>
      </ul>
    </div>

    <div class="help-section">
      <h5>3. Related Standards</h5>
      <ul>
        <li><a class="link" href="https://example.org/ogcapi-processes" target="_blank">OGC API - Processes (execution model)</a></li>
      </ul>
    </div>

    <div class="help-section">
      <h5>4. FAQ — Common execution failures</h5>
      <ul>
        <li>Transmission mode wrong (value vs reference) — try switching mode or preview the payload.</li>
        <li>Auth token missing/expired — re-login and try again.</li>
        <li>Complex input URL unreachable — ensure the URL is publicly accessible or use inline data.</li>
      </ul>
    </div>
  </div>
`