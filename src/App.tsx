import { parseBatteryReportHtml } from "./lib/parseBatteryReport";

async function loadTest() {
  const res = await fetch("/battery-report.html");
  const html = await res.text();

  const data = parseBatteryReportHtml(html);
  console.log(data);
}

function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Battery Dashboard</h1>
      <button onClick={loadTest}>Test Parser</button>
    </div>
  );
}

export default App;