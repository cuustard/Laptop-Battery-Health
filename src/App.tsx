import { parseBatteryReportHtml } from "./lib/parseBatteryReport";

async function loadTest() {
  console.log("Button clicked");

  try {
    const res = await fetch("/battery-report.html");
    console.log("Fetch response:", res.status, res.statusText);

    const html = await res.text();
    console.log("HTML length:", html.length);

    const data = parseBatteryReportHtml(html);
    console.log("Parsed data:", data);

    alert("Parser ran. Check console.");
  } catch (error) {
    console.error("loadTest failed:", error);
    alert("Something failed. Check console.");
  }
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