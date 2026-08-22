import fetch from "node-fetch";

async function test() {
  const res = await fetch("https://emkc.org/api/v2/piston/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "python",
      version: "3.10.0",
      files: [{ name: "main.py", content: "print(1)" }]
    })
  });
  console.log("Status:", res.status);
  console.log("Text:", await res.text());
}
test();
