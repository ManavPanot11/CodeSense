async function test() {
  try {
    const res = await fetch("https://emkc.org/api/v2/piston/runtimes");
    const json = await res.json();
    console.log(json.map(r => `${r.language} (${r.aliases.join(", ")})`).join("\n"));
  } catch (err) {
    console.error(err);
  }
}
test();
